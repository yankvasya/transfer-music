import { useCallback, useState } from 'react';

export interface TokenStorage {
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiry: number | null;
  // `refresh` follows the same "only overwrite if provided" rule every service already
  // relied on (some OAuth providers only return a refresh_token on the first consent,
  // not on every refresh) — pass undefined to leave the stored one untouched.
  // `expiresIn` of null means "never expires" (Deezer's offline_access tokens).
  saveTokens: (access: string, refresh: string | undefined, expiresIn: number | null) => void;
  clearTokens: () => void;
}

// The access/refresh/expiry-in-localStorage pattern, previously duplicated near-verbatim
// across all four auth hooks — this covers only that mechanical storage layer. Each
// hook's actual OAuth flow (login redirect, code exchange, refresh request, apiRequest
// wrapper) stays where it is; those genuinely differ per service and don't belong here.
export function useTokenStorage(prefix: string, options: { hasRefreshToken?: boolean } = {}): TokenStorage {
  const hasRefreshToken = options.hasRefreshToken ?? true;

  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem(`${prefix}_access_token`));
  const [refreshToken, setRefreshToken] = useState<string | null>(() =>
    hasRefreshToken ? localStorage.getItem(`${prefix}_refresh_token`) : null
  );
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(() => {
    const expiry = localStorage.getItem(`${prefix}_token_expiry`);
    return expiry ? parseInt(expiry, 10) : null;
  });

  const saveTokens = useCallback(
    (access: string, refresh: string | undefined, expiresIn: number | null) => {
      const expiryTime = expiresIn !== null ? Date.now() + expiresIn * 1000 : null;
      setAccessToken(access);
      setTokenExpiry(expiryTime);
      localStorage.setItem(`${prefix}_access_token`, access);
      if (expiryTime !== null) {
        localStorage.setItem(`${prefix}_token_expiry`, expiryTime.toString());
      } else {
        localStorage.removeItem(`${prefix}_token_expiry`);
      }

      if (hasRefreshToken && refresh) {
        setRefreshToken(refresh);
        localStorage.setItem(`${prefix}_refresh_token`, refresh);
      }
    },
    [prefix, hasRefreshToken]
  );

  const clearTokens = useCallback(() => {
    setAccessToken(null);
    setRefreshToken(null);
    setTokenExpiry(null);
    localStorage.removeItem(`${prefix}_access_token`);
    localStorage.removeItem(`${prefix}_refresh_token`);
    localStorage.removeItem(`${prefix}_token_expiry`);
  }, [prefix]);

  return { accessToken, refreshToken, tokenExpiry, saveTokens, clearTokens };
}
