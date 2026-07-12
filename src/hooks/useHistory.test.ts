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

  it('restoreHistory merges a backup, overwrites on id collision, and drops entries missing id/service', () => {
    const { result } = renderHook(() => useHistory());

    act(() => {
      result.current.completeEntry('existing', { ...SUMMARY, name: 'Old Name' });
    });

    let restoredCount = 0;
    act(() => {
      restoredCount = result.current.restoreHistory([
        { ...SUMMARY, id: 'existing', name: 'Restored Name', createdAt: 1, status: 'completed' },
        { ...SUMMARY, id: 'brand-new', name: 'New Entry', createdAt: 2, status: 'completed' },
        { name: 'Missing id/service' }, // invalid — should be dropped, not crash
        null,
      ]);
    });

    expect(restoredCount).toBe(2);
    expect(result.current.history).toHaveLength(2);
    expect(result.current.history.find((h) => h.id === 'existing')?.name).toBe('Restored Name');
    expect(result.current.history.find((h) => h.id === 'brand-new')?.name).toBe('New Entry');
  });

  it('restoreHistory returns 0 and leaves history untouched when nothing in the file is valid', () => {
    const { result } = renderHook(() => useHistory());

    let restoredCount = 1;
    act(() => {
      restoredCount = result.current.restoreHistory([{ foo: 'bar' }, 42, 'not an entry']);
    });

    expect(restoredCount).toBe(0);
    expect(result.current.history).toHaveLength(0);
  });
});
