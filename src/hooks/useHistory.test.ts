import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useHistory } from './useHistory';

const SUMMARY = { service: 'spotify' as const, name: 'My Playlist', url: 'https://example.com/pl', matched: 1, failed: 0, total: 1 };

describe('useHistory', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the in-memory entry even when localStorage.setItem throws (e.g. quota exceeded)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useHistory());

    act(() => {
      result.current.completeEntry('h1', SUMMARY);
    });

    // The write to storage failed, but the entry must still show up in the UI's history
    // list — a full storage shouldn't crash the app or silently drop what just happened.
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].name).toBe('My Playlist');
    expect(consoleError).toHaveBeenCalled();
  });

  it('persists and removes entries normally when storage works', () => {
    const { result } = renderHook(() => useHistory());

    act(() => {
      result.current.completeEntry('h1', SUMMARY);
    });
    expect(JSON.parse(localStorage.getItem('transfer_music_history')!)).toHaveLength(1);

    act(() => {
      result.current.removeEntry('h1');
    });
    expect(result.current.history).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem('transfer_music_history')!)).toHaveLength(0);
  });
});
