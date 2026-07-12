import { useState, useEffect, useCallback } from 'react';
import { useStoredValue } from './useStoredValue';
import { useTokenStorage } from './useTokenStorage';

const AUTHORIZE_ENDPOINT = 'https://connect.deezer.com/oauth/auth.php';
const AUTH_PROXY = '/api/deezer-auth';
const DATA_PROXY = '/api/deezer-data';
// offline_access grants a token that never expires. Deezer has no refresh_token concept
// at all, so without this perm the user would have to re-run the full redirect flow
// every time the token lapsed instead of just staying logged in.
const PERMS = 'basic_access,manage_library,offline_access';

export interface DeezerUser {
  id: string;
  display_name: string;
  images: { url: string }[];
}

function getRedirectUri(): string {
  const envUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;
  if (envUri) return envUri;
  return window.location.origin + '/';
}

// Deezer has no PKCE option and no shared/public app credential the way Yandex does, so
// (like Spotify/YouTube's Client ID) the user brings their own app_id + app_secret,
// registered at developers.deezer.com/myapps. Both are stored client-side only and sent
// to this app's own /api/deezer-auth proxy per request — never persisted server-side.
export function useDeezer() {
  const [appId, setAppId] = useStoredValue('deezer_app_id');
  const [appSecret, setAppSecret] = useStoredValue('deezer_app_secret');

  // null means "never expires" (offline_access), not "no token" — accessToken covers that
  // case. Deezer has no refresh_token concept, so hasRefreshToken is disabled.
  const { accessToken, tokenExpiry, saveTokens: storeTokens, clearTokens } = useTokenStorage('deezer', {
    hasRefreshToken: false,
  });

  const [user, setUser] = useState<DeezerUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    setIsAuthenticated(false);
  }, [clearTokens]);

  const saveTokens = useCallback(
    (access: string, expiresInSeconds: number) => {
      storeTokens(access, undefined, expiresInSeconds > 0 ? expiresInSeconds : null);
      setIsAuthenticated(true);
    },
    [storeTokens]
  );

  const login = useCallback(() => {
    if (!appId || !appSecret) {
      alert('Please enter your Deezer App ID and Secret Key first.');
      return;
    }

    // Identifies this specific login attempt, so the redirect callback can tell a Deezer
    // code apart from another service's (Spotify/YouTube) if more than one is mid-flow.
    const state = crypto.randomUUID();
    localStorage.setItem('deezer_oauth_state', state);

    const params = new URLSearchParams({
      app_id: appId,
      redirect_uri: getRedirectUri(),
      perms: PERMS,
      state,
    });

    window.location.href = `${AUTHORIZE_ENDPOINT}?${params.toString()}`;
  }, [appId, appSecret]);

  const exchangeCodeForTokens = useCallback(
    async (code: string) => {
      setIsLoading(true);
      try {
        const res = await fetch(AUTH_PROXY, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appId, appSecret, code, redirectUri: getRedirectUri() }),
        });
        const data = await res.json();
        if (!res.ok || !data.access_token) {
          throw new Error(data.error_description || data.error || 'Failed to connect to Deezer');
        }
        saveTokens(data.access_token, data.expires ?? 0);
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (err) {
        console.error('Error during Deezer token exchange:', err);
        alert('Failed to connect to Deezer. Check your App ID/Secret configuration.');
      } finally {
        setIsLoading(false);
      }
    },
    [appId, appSecret, saveTokens]
  );

  const fetchUser = useCallback(
    async (token: string) => {
      try {
        const res = await fetch(`${DATA_PROXY}?path=${encodeURIComponent('/user/me')}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data && data.error) {
          if (data.error.code === 300) logout(); // OAuthTokenInvalid
          return;
        }
        if (data?.id) {
          setUser({
            id: String(data.id),
            display_name: data.name || data.email || 'Deezer User',
            images: data.picture ? [{ url: data.picture }] : [],
          });
        }
      } catch (err) {
        console.error('Error fetching Deezer account info:', err);
      }
    },
    [logout]
  );

  // Effect: handle the OAuth redirect callback (state-matched, so a code meant for
  // another service mid-flow isn't picked up by mistake).
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const expectedState = localStorage.getItem('deezer_oauth_state');

    if (code && state && expectedState && state === expectedState) {
      localStorage.removeItem('deezer_oauth_state');
      exchangeCodeForTokens(code);
    } else {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exchangeCodeForTokens]);

  // Effect: auto-fetch user details for an existing session. No refresh_token exists, so
  // an expired token just logs out rather than attempting to refresh.
  useEffect(() => {
    if (accessToken) {
      if (!tokenExpiry || Date.now() < tokenExpiry) {
        setIsAuthenticated(true);
        fetchUser(accessToken);
      } else {
        logout();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, tokenExpiry]);

  // Generic Deezer Web API wrapper, routed through /api/deezer-data. Deezer returns
  // errors as HTTP 200 with an {error: {...}} body, so success/failure has to be read
  // from the payload rather than the status code.
  const apiRequest = useCallback(
    async (endpoint: string, options: RequestInit = {}): Promise<any> => {
      if (!accessToken) {
        throw new Error('Not authenticated with Deezer');
      }

      const response = await fetch(`${DATA_PROXY}?path=${encodeURIComponent(endpoint)}`, {
        ...options,
        headers: {
          ...(options.headers as Record<string, string> | undefined),
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await response.json();

      if (data && data.error) {
        // Error code 4 = Quota (rate limit). No Retry-After equivalent is available since
        // these come back as HTTP 200, so fall back to a fixed short wait.
        if (data.error.code === 4) {
          return { isRateLimited: true, waitSeconds: 5 };
        }
        if (data.error.code === 300) {
          logout();
          throw new Error('Deezer session expired — please log in again.');
        }
        throw new Error(`Deezer API error [${data.error.code}]: ${data.error.message || data.error.type}`);
      }

      return data;
    },
    [accessToken, logout]
  );

  return {
    appId,
    setAppId,
    appSecret,
    setAppSecret,
    isAuthenticated,
    isLoading,
    login,
    user,
    logout,
    apiRequest,
  };
}
