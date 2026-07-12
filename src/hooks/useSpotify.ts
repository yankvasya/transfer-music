import { useState, useEffect, useCallback } from 'react';
import { generateCodeVerifier, generateCodeChallenge } from '../utils/pkce';
import { useStoredValue } from './useStoredValue';
import { useTokenStorage } from './useTokenStorage';

const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
const AUTHORIZE_ENDPOINT = 'https://accounts.spotify.com/authorize';
const API_BASE = 'https://api.spotify.com/v1';

export interface SpotifyUser {
  id: string;
  display_name: string;
  images: { url: string }[];
}

export function useSpotify() {
  const [clientId, setClientId] = useStoredValue('spotify_custom_client_id', import.meta.env.VITE_SPOTIFY_CLIENT_ID);
  const { accessToken, refreshToken, tokenExpiry, saveTokens: storeTokens, clearTokens } = useTokenStorage('spotify');

  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const getRedirectUri = useCallback(() => {
    const envUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;
    if (envUri) return envUri;
    // Always the site root, regardless of which route the user is currently on —
    // this must exactly match what's registered in the Spotify Developer Dashboard.
    return window.location.origin + '/';
  }, []);

  // Save tokens to storage and mark the session authenticated.
  const saveTokens = useCallback(
    (access: string, refresh: string | undefined, expiresIn: number) => {
      storeTokens(access, refresh, expiresIn);
      setIsAuthenticated(true);
    },
    [storeTokens]
  );

  // Logout / clear credentials
  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('spotify_code_verifier');
  }, [clearTokens]);

  // Refresh access token using refresh_token
  const refreshSpotifyToken = useCallback(async (): Promise<string | null> => {
    if (!refreshToken || !clientId) return null;

    try {
      const response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
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
      saveTokens(
        data.access_token,
        data.refresh_token, // Spotify might not return a new refresh token — saveTokens keeps the old one
        data.expires_in
      );
      return data.access_token;
    } catch (error) {
      console.error('Error refreshing token:', error);
      logout();
      return null;
    }
  }, [refreshToken, clientId, saveTokens, logout]);

  // Retrieve valid access token, refreshing if necessary
  const getValidToken = useCallback(async (): Promise<string | null> => {
    if (!accessToken || !tokenExpiry) return null;
    // Refresh token if it expires in less than 5 minutes (300,000ms)
    if (Date.now() + 300000 >= tokenExpiry) {
      return await refreshSpotifyToken();
    }
    return accessToken;
  }, [accessToken, tokenExpiry, refreshSpotifyToken]);

  // Initiate Spotify OAuth PKCE authorization redirect
  const login = useCallback(async () => {
    if (!clientId) {
      alert('Please enter or configure a Spotify Client ID first.');
      return;
    }

    const codeVerifier = generateCodeVerifier();
    localStorage.setItem('spotify_code_verifier', codeVerifier);

    // Identifies this specific login attempt, so the redirect callback can tell a Spotify
    // code apart from another service's (e.g. YouTube) if both are mid-flow at once.
    const state = crypto.randomUUID();
    localStorage.setItem('spotify_oauth_state', state);

    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const redirectUri = getRedirectUri();

    // Scopes needed for profile and playlist modifications
    const scope = 'playlist-modify-public playlist-modify-private playlist-read-private user-read-private';

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      scope: scope,
      state: state,
    });

    window.location.href = `${AUTHORIZE_ENDPOINT}?${params.toString()}`;
  }, [clientId, getRedirectUri]);

  // Exchange auth code for tokens
  const exchangeCodeForTokens = useCallback(async (code: string) => {
    const codeVerifier = localStorage.getItem('spotify_code_verifier');
    if (!codeVerifier) {
      console.error('Code verifier missing from localStorage');
      return;
    }

    setIsLoading(true);
    const redirectUri = getRedirectUri();

    try {
      const response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
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

      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
      console.error('Error during token exchange:', error);
      alert('Failed to connect to Spotify. Check your Client ID configuration.');
    } finally {
      setIsLoading(false);
    }
  }, [clientId, getRedirectUri, saveTokens]);

  // Fetch current user details
  const fetchUser = useCallback(async (token: string) => {
    try {
      const response = await fetch(`${API_BASE}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else if (response.status === 401) {
        logout();
      }
    } catch (error) {
      console.error('Error fetching Spotify user info:', error);
    }
  }, [logout]);

  // Effect: Handle authorization redirect callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const expectedState = localStorage.getItem('spotify_oauth_state');

    // Only handle this redirect if its state matches ours — with more than one OAuth
    // flow on the page (e.g. YouTube), a code in the URL might belong to a different one.
    if (code && state && expectedState && state === expectedState) {
      localStorage.removeItem('spotify_oauth_state');
      exchangeCodeForTokens(code);
    } else {
      setIsLoading(false);
    }
  }, [exchangeCodeForTokens]);

  // Effect: Auto-fetch user details if authenticated
  useEffect(() => {
    if (accessToken && tokenExpiry) {
      if (Date.now() < tokenExpiry) {
        setIsAuthenticated(true);
        fetchUser(accessToken);
      } else {
        // Token expired, attempt refresh
        refreshSpotifyToken().then((newToken) => {
          if (newToken) {
            fetchUser(newToken);
          }
        });
      }
    }
  }, [accessToken, tokenExpiry, fetchUser, refreshSpotifyToken]);

  // Generic Spotify API Wrapper with rate-limit and auth handling
  const apiRequest = useCallback(async (
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<any> => {
    const token = await getValidToken();
    if (!token) {
      throw new Error('Not authenticated with Spotify');
    }

    const headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    const response = await fetch(url, { ...options, headers });

    if (response.ok) {
      if (response.status === 204) return null; // No Content
      return await response.json();
    }

    // Handle Rate Limiting (429)
    if (response.status === 429) {
      const retryAfterHeader = response.headers.get('Retry-After');
      const waitSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : Math.pow(2, retryCount) * 2;
      console.warn(`Rate limited (429). Retrying after ${waitSeconds} seconds...`);

      // Bubble up the rate-limit information so the UI can show progress/pause
      return {
        isRateLimited: true,
        waitSeconds,
        retry: () => new Promise((resolve) => setTimeout(() => resolve(apiRequest(endpoint, options, retryCount + 1)), waitSeconds * 1000))
      };
    }

    if (response.status === 401 && retryCount < 1) {
      // Access token might have expired, force refresh once
      const refreshedToken = await refreshSpotifyToken();
      if (refreshedToken) {
        return await apiRequest(endpoint, options, retryCount + 1);
      }
    }

    const errBody = await response.text();
    throw new Error(`Spotify API error [${response.status}]: ${errBody || response.statusText}`);
  }, [getValidToken, refreshSpotifyToken]);

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
