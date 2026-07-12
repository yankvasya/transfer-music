import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useTokenStorage } from './useTokenStorage';

describe('useTokenStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes from localStorage', () => {
    localStorage.setItem('spotify_access_token', 'at');
    localStorage.setItem('spotify_refresh_token', 'rt');
    localStorage.setItem('spotify_token_expiry', '12345');

    const { result } = renderHook(() => useTokenStorage('spotify'));
    expect(result.current.accessToken).toBe('at');
    expect(result.current.refreshToken).toBe('rt');
    expect(result.current.tokenExpiry).toBe(12345);
  });

  it('saveTokens persists access/refresh/expiry to both state and localStorage', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const { result } = renderHook(() => useTokenStorage('spotify'));

    act(() => result.current.saveTokens('new-access', 'new-refresh', 3600));

    expect(result.current.accessToken).toBe('new-access');
    expect(result.current.refreshToken).toBe('new-refresh');
    expect(result.current.tokenExpiry).toBe(1_000_000 + 3600 * 1000);
    expect(localStorage.getItem('spotify_access_token')).toBe('new-access');
    expect(localStorage.getItem('spotify_refresh_token')).toBe('new-refresh');
    expect(localStorage.getItem('spotify_token_expiry')).toBe(String(1_000_000 + 3600 * 1000));
    vi.useRealTimers();
  });

  it('keeps the existing refresh token when saveTokens is called without a new one', () => {
    const { result } = renderHook(() => useTokenStorage('youtube'));

    act(() => result.current.saveTokens('access-1', 'refresh-1', 3600));
    act(() => result.current.saveTokens('access-2', undefined, 3600));

    expect(result.current.accessToken).toBe('access-2');
    expect(result.current.refreshToken).toBe('refresh-1');
    expect(localStorage.getItem('youtube_refresh_token')).toBe('refresh-1');
  });

  it('treats a null expiresIn as "never expires" (Deezer offline_access) and never reads/writes a refresh token when disabled', () => {
    const { result } = renderHook(() => useTokenStorage('deezer', { hasRefreshToken: false }));

    act(() => result.current.saveTokens('access-1', 'ignored-refresh', null));

    expect(result.current.tokenExpiry).toBeNull();
    expect(result.current.refreshToken).toBeNull();
    expect(localStorage.getItem('deezer_token_expiry')).toBeNull();
    expect(localStorage.getItem('deezer_refresh_token')).toBeNull();
  });

  it('clearTokens resets state and removes all three keys from localStorage', () => {
    const { result } = renderHook(() => useTokenStorage('spotify'));
    act(() => result.current.saveTokens('a', 'r', 3600));

    act(() => result.current.clearTokens());

    expect(result.current.accessToken).toBeNull();
    expect(result.current.refreshToken).toBeNull();
    expect(result.current.tokenExpiry).toBeNull();
    expect(localStorage.getItem('spotify_access_token')).toBeNull();
    expect(localStorage.getItem('spotify_refresh_token')).toBeNull();
    expect(localStorage.getItem('spotify_token_expiry')).toBeNull();
  });
});
