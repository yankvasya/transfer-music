import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTheme } from './useTheme';

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to auto with no data-theme attribute when nothing is stored', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current[0]).toBe('auto');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('initializes from a previously stored explicit choice and stamps the attribute', () => {
    localStorage.setItem('theme', 'dark');
    const { result } = renderHook(() => useTheme());
    expect(result.current[0]).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('setting an explicit theme persists it and stamps data-theme; back to auto removes it', () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current[1]('light'));
    expect(result.current[0]).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('theme')).toBe('light');

    act(() => result.current[1]('auto'));
    expect(result.current[0]).toBe('auto');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem('theme')).toBeNull();
  });

  it('ignores a garbage stored value and falls back to auto', () => {
    localStorage.setItem('theme', 'not-a-real-theme');
    const { result } = renderHook(() => useTheme());
    expect(result.current[0]).toBe('auto');
  });
});
