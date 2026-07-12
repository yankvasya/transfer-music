import { useState, useEffect, useCallback } from 'react';
import { generateCodeVerifier, generateCodeChallenge } from '../utils/pkce';
import { useStoredValue } from './useStoredValue';
import { useTokenStorage } from './useTokenStorage';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const AUTHORIZE_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const API_BASE = 'https://www.googleapis.com/youtube/v3';

export interface YouTubeUser {
  id: string;
  display_name: string;
  images: { url: string }[];
}

// Sentinel returned by apiRequest instead of throwing, so callers can distinguish
// "the daily quota ran out" (nothing to retry, needs a circuit breaker) from a real error.
export interface QuotaExceeded {
  isQuotaExceeded: true;
}

export function useYouTube() {
  const [clientId, setClientId] = useStoredValue('youtube_custom_client_id', import.meta.env.VITE_YOUTUBE_CLIENT_ID);
  const { accessToken, refreshToken, tokenExpiry, saveTokens: storeTokens, clearTokens } = useTokenStorage('youtube');

  const [user, setUser] = useState<YouTubeUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const getRedirectUri = useCallback(() => {
    const envUri = import.meta.env.VITE_YOUTUBE_REDIRECT_URI;
    if (envUri) return envUri;
    // Always the site root, regardless of which route the user is currently on —
    // this must exactly match what's registered in the Google Cloud OAuth client.
    return window.location.origin + '/';
  }, []);

  const saveTokens = useCallback(
    (access: string, refresh: string | undefined, expiresIn: number) => {
      storeTokens(access, refresh, expiresIn);
      setIsAuthenticated(true);
    },
    [storeTokens]
  );

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('youtube_code_verifier');
  }, [clearTokens]);

  const refreshYouTubeToken = useCallback(async (): Promise<string | null> => {
    if (!refreshToken || !clientId) return null;

    try {
      const response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh access token');
      }

      const data = await response.json();
      saveTokens(data.access_token, data.refresh_token, data.expires_in);
      return data.access_token;
    } catch (error) {
      console.error('Error refreshing YouTube token:', error);
      logout();
      return null;
    }
  }, [refreshToken, clientId, saveTokens, logout]);

  const getValidToken = useCallback(async (): Promise<string | null> => {
    if (!accessToken || !tokenExpiry) return null;
    if (Date.now() + 300000 >= tokenExpiry) {
      return await refreshYouTubeToken();
    }
    return accessToken;
  }, [accessToken, tokenExpiry, refreshYouTubeToken]);

  const login = useCallback(async () => {
    if (!clientId) {
      alert('Please enter or configure a Google OAuth Client ID first.');
      return;
    }

    const codeVerifier = generateCodeVerifier();
    localStorage.setItem('youtube_code_verifier', codeVerifier);

    const state = crypto.randomUUID();
    localStorage.setItem('youtube_oauth_state', state);

    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const redirectUri = getRedirectUri();

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      scope: 'https://www.googleapis.com/auth/youtube',
      access_type: 'offline',
      prompt: 'consent',
      state: state,
    });

    window.location.href = `${AUTHORIZE_ENDPOINT}?${params.toString()}`;
  }, [clientId, getRedirectUri]);

  const exchangeCodeForTokens = useCallback(async (code: string) => {
    const codeVerifier = localStorage.getItem('youtube_code_verifier');
    if (!codeVerifier) {
      console.error('Code verifier missing from localStorage');
      return;
    }

    setIsLoading(true);
    const redirectUri = getRedirectUri();

    try {
      const response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri,
          client_id: clientId,
          code_verifier: codeVerifier,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token exchange failed: ${errorText}`);
      }

      const data = await response.json();
      saveTokens(data.access_token, data.refresh_token, data.expires_in);

      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
      console.error('Error during YouTube token exchange:', error);
      alert('Failed to connect to YouTube. Check your Client ID configuration.');
    } finally {
      setIsLoading(false);
    }
  }, [clientId, getRedirectUri, saveTokens]);

  const fetchUser = useCallback(async (token: string) => {
    try {
      const response = await fetch(`${API_BASE}/channels?part=snippet&mine=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const channel = data.items?.[0];
        if (channel) {
          setUser({
            id: channel.id,
            display_name: channel.snippet?.title || 'YouTube User',
            images: channel.snippet?.thumbnails?.default?.url ? [{ url: channel.snippet.thumbnails.default.url }] : [],
          });
        }
      } else if (response.status === 401) {
        logout();
      }
    } catch (error) {
      console.error('Error fetching YouTube channel info:', error);
    }
  }, [logout]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const expectedState = localStorage.getItem('youtube_oauth_state');

    if (code && state && expectedState && state === expectedState) {
      localStorage.removeItem('youtube_oauth_state');
      exchangeCodeForTokens(code);
    } else {
      setIsLoading(false);
    }
  }, [exchangeCodeForTokens]);

  useEffect(() => {
    if (accessToken && tokenExpiry) {
      if (Date.now() < tokenExpiry) {
        setIsAuthenticated(true);
        fetchUser(accessToken);
      } else {
        refreshYouTubeToken().then((newToken) => {
          if (newToken) {
            fetchUser(newToken);
          }
        });
      }
    }
  }, [accessToken, tokenExpiry, fetchUser, refreshYouTubeToken]);

  // Generic YouTube Data API wrapper. Unlike Spotify's short rolling-window rate limit,
  // YouTube's binding constraint is a daily quota — there's nothing useful to wait out
  // within a session, so a quota error is surfaced as a sentinel instead of retried.
  const apiRequest = useCallback(async (
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<any> => {
    const token = await getValidToken();
    if (!token) {
      throw new Error('Not authenticated with YouTube');
    }

    const headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    const response = await fetch(url, { ...options, headers });

    if (response.ok) {
      if (response.status === 204) return null;
      return await response.json();
    }

    const errBody = await response.text();

    if (response.status === 403 && /quota/i.test(errBody)) {
      console.warn('YouTube API quota exceeded.');
      const quotaExceeded: QuotaExceeded = { isQuotaExceeded: true };
      return quotaExceeded;
    }

    if (response.status === 401 && retryCount < 1) {
      const refreshedToken = await refreshYouTubeToken();
      if (refreshedToken) {
        return await apiRequest(endpoint, options, retryCount + 1);
      }
    }

    throw new Error(`YouTube API error [${response.status}]: ${errBody || response.statusText}`);
  }, [getValidToken, refreshYouTubeToken]);

  return {
    clientId,
    setClientId,
    accessToken,
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    apiRequest,
  };
}
