import { useState, useEffect, useCallback, useRef } from 'react';

const AUTH_PROXY = '/api/yandex-auth';
const DATA_PROXY = '/api/yandex-data';

export interface YandexUser {
  id: string;
  display_name: string;
  images: { url: string }[];
}

export interface YandexDeviceCode {
  userCode: string;
  verificationUrl: string;
}

// Yandex Music has no third-party developer program — there's no Client ID step here.
// Auth instead uses the OAuth Device Flow (RFC 8628): request a code, show it to the
// user alongside a link, poll until they've confirmed on Yandex's own page. All of the
// actual OAuth/API calls go through this app's own /api/yandex-* serverless proxies,
// since api.music.yandex.net sends no CORS headers and can't be called directly from
// the browser (verified directly, not assumed).
export function useYandexMusic() {
  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem('yandex_access_token'));
  const [refreshToken, setRefreshToken] = useState<string | null>(() => localStorage.getItem('yandex_refresh_token'));
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(() => {
    const expiry = localStorage.getItem('yandex_token_expiry');
    return expiry ? parseInt(expiry, 10) : null;
  });

  const [user, setUser] = useState<YandexUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Device flow state, surfaced for the login UI to render.
  const [deviceCode, setDeviceCode] = useState<YandexDeviceCode | null>(null);
  const [authStatus, setAuthStatus] = useState<'idle' | 'waiting' | 'error'>('idle');
  const [authError, setAuthError] = useState<string | null>(null);

  const pollTimeoutRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  const saveTokens = useCallback((access: string, refresh: string | undefined, expiresIn: number) => {
    const expiryTime = Date.now() + expiresIn * 1000;
    setAccessToken(access);
    setTokenExpiry(expiryTime);
    setIsAuthenticated(true);
    localStorage.setItem('yandex_access_token', access);
    localStorage.setItem('yandex_token_expiry', expiryTime.toString());
    if (refresh) {
      setRefreshToken(refresh);
      localStorage.setItem('yandex_refresh_token', refresh);
    }
  }, []);

  const logout = useCallback(() => {
    cancelledRef.current = true;
    if (pollTimeoutRef.current) window.clearTimeout(pollTimeoutRef.current);
    setAccessToken(null);
    setRefreshToken(null);
    setTokenExpiry(null);
    setUser(null);
    setIsAuthenticated(false);
    setDeviceCode(null);
    setAuthStatus('idle');
    setAuthError(null);
    localStorage.removeItem('yandex_access_token');
    localStorage.removeItem('yandex_refresh_token');
    localStorage.removeItem('yandex_token_expiry');
  }, []);

  const refreshYandexToken = useCallback(async (): Promise<string | null> => {
    if (!refreshToken) return null;
    try {
      const res = await fetch(AUTH_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh', refreshToken }),
      });
      const data = await res.json();
      if (!res.ok || !data.access_token) {
        throw new Error(data.error_description || data.error || 'Failed to refresh token');
      }
      saveTokens(data.access_token, data.refresh_token, data.expires_in);
      return data.access_token;
    } catch (err) {
      console.error('Error refreshing Yandex token:', err);
      logout();
      return null;
    }
  }, [refreshToken, saveTokens, logout]);

  const getValidToken = useCallback(async (): Promise<string | null> => {
    if (!accessToken || !tokenExpiry) return null;
    if (Date.now() + 300000 >= tokenExpiry) {
      return await refreshYandexToken();
    }
    return accessToken;
  }, [accessToken, tokenExpiry, refreshYandexToken]);

  const fetchUser = useCallback(
    async (token: string) => {
      try {
        const res = await fetch(`${DATA_PROXY}?path=${encodeURIComponent('/account/status')}`, {
          headers: { Authorization: `OAuth ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const account = data?.result?.account ?? data?.account;
          if (account?.uid) {
            setUser({
              id: String(account.uid),
              display_name: account.display_name || account.login || 'Yandex User',
              images: [],
            });
          }
        } else if (res.status === 401) {
          logout();
        }
      } catch (err) {
        console.error('Error fetching Yandex account info:', err);
      }
    },
    [logout]
  );

  // Kicks off the device flow: request a code, surface it via `deviceCode` for the UI,
  // then poll until the user confirms (or the code expires / they cancel).
  const startDeviceAuth = useCallback(async () => {
    cancelledRef.current = false;
    setAuthStatus('waiting');
    setAuthError(null);
    setDeviceCode(null);

    try {
      const res = await fetch(AUTH_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'device_code' }),
      });
      const code = await res.json();
      if (!res.ok || !code.device_code) {
        throw new Error(code.error_description || code.error || 'Failed to start Yandex login');
      }

      setDeviceCode({ userCode: code.user_code, verificationUrl: code.verification_url });

      const deadline = Date.now() + code.expires_in * 1000;
      const intervalMs = Math.max(code.interval, 1) * 1000;

      const poll = async () => {
        if (cancelledRef.current) return;
        if (Date.now() >= deadline) {
          setAuthStatus('error');
          setAuthError('Code expired before it was confirmed. Try again.');
          setDeviceCode(null);
          return;
        }

        try {
          const pollRes = await fetch(AUTH_PROXY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'poll', deviceCode: code.device_code }),
          });
          const data = await pollRes.json();

          if (pollRes.ok && data.access_token) {
            saveTokens(data.access_token, data.refresh_token, data.expires_in);
            // Unlike the redirect-based flows, device flow never reloads the page, so the
            // mount effect won't run again to pick up the account — fetch it now.
            fetchUser(data.access_token);
            setDeviceCode(null);
            setAuthStatus('idle');
            return;
          }

          if (data.error === 'authorization_pending' || data.error === 'slow_down') {
            pollTimeoutRef.current = window.setTimeout(poll, intervalMs);
            return;
          }

          throw new Error(data.error_description || data.error || 'Login failed');
        } catch (err: any) {
          if (cancelledRef.current) return;
          setAuthStatus('error');
          setAuthError(err.message || 'Login failed');
          setDeviceCode(null);
        }
      };

      pollTimeoutRef.current = window.setTimeout(poll, intervalMs);
    } catch (err: any) {
      setAuthStatus('error');
      setAuthError(err.message || 'Failed to start Yandex login');
    }
  }, [saveTokens, fetchUser]);

  const cancelDeviceAuth = useCallback(() => {
    cancelledRef.current = true;
    if (pollTimeoutRef.current) window.clearTimeout(pollTimeoutRef.current);
    setDeviceCode(null);
    setAuthStatus('idle');
    setAuthError(null);
  }, []);

  // Effect: on mount, validate/refresh any existing session (no URL callback to handle —
  // unlike the redirect flows, the whole device flow happens without navigating away).
  useEffect(() => {
    let active = true;

    const init = async () => {
      if (accessToken && tokenExpiry) {
        if (Date.now() < tokenExpiry) {
          setIsAuthenticated(true);
          await fetchUser(accessToken);
        } else {
          const newToken = await refreshYandexToken();
          if (newToken) await fetchUser(newToken);
        }
      }
      if (active) setIsLoading(false);
    };

    init();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Generic Yandex Music Data API wrapper, routed through /api/yandex-data. Yandex wraps
  // most responses in {result: ...}; unwrapped here so callers get the payload directly.
  const apiRequest = useCallback(
    async (endpoint: string, options: RequestInit = {}, retryCount = 0): Promise<any> => {
      const token = await getValidToken();
      if (!token) {
        throw new Error('Not authenticated with Yandex Music');
      }

      const headers: Record<string, string> = {
        ...(options.headers as Record<string, string> | undefined),
        Authorization: `OAuth ${token}`,
      };
      if (options.body && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }

      const response = await fetch(`${DATA_PROXY}?path=${encodeURIComponent(endpoint)}`, { ...options, headers });
      const text = await response.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      if (response.ok) {
        return data && typeof data === 'object' && data.result !== undefined && data.result !== null ? data.result : data;
      }

      // No documented rate-limit behavior for this API, but handle 429 defensively the
      // same way the other connectors do, in case it ever happens.
      if (response.status === 429) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const waitSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : Math.pow(2, retryCount) * 2;
        return { isRateLimited: true, waitSeconds };
      }

      if (response.status === 401 && retryCount < 1) {
        const refreshedToken = await refreshYandexToken();
        if (refreshedToken) {
          return await apiRequest(endpoint, options, retryCount + 1);
        }
      }

      throw new Error(`Yandex Music API error [${response.status}]: ${data.error_description || data.error || text || response.statusText}`);
    },
    [getValidToken, refreshYandexToken]
  );

  return {
    user,
    isAuthenticated,
    isLoading,
    logout,
    apiRequest,
    deviceCode,
    authStatus,
    authError,
    startDeviceAuth,
    cancelDeviceAuth,
  };
}
