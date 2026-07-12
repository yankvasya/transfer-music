import { useCallback, useState } from 'react';

// The clientId (Spotify/YouTube)/appId/appSecret (Deezer) pattern, previously duplicated
// verbatim across those hooks: a string that's user-editable, persisted to localStorage
// so it survives a reload, with an optional env var used only as the initial default.
export function useStoredValue(key: string, envFallback?: string): [string, (value: string) => void] {
  const [value, setValueState] = useState<string>(() => localStorage.getItem(key) || envFallback || '');

  const setValue = useCallback(
    (next: string) => {
      setValueState(next);
      if (next) {
        localStorage.setItem(key, next);
      } else {
        localStorage.removeItem(key);
      }
    },
    [key]
  );

  return [value, setValue];
}
