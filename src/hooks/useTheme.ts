import { useCallback, useEffect, useState } from 'react';

export type Theme = 'auto' | 'light' | 'dark';

const STORAGE_KEY = 'theme';

// 'auto' means "follow the OS" and is expressed by NOT setting data-theme at all — the
// CSS's own prefers-color-scheme media query handles that case. Only an explicit
// light/dark choice stamps the attribute, so it can override the system preference.
function applyTheme(theme: Theme) {
  if (theme === 'auto') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'auto';
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    if (next === 'auto') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  return [theme, setTheme];
}
