import { describe, expect, it, vi, afterEach } from 'vitest';
import { fetchPlaylistFromLink } from './anonymousImport';

describe('fetchPlaylistFromLink (Deezer)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('fetches the playlist name and track lines with no Authorization header', async () => {
    const calls: RequestInfo[] = [];
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(input as RequestInfo);
      expect(init?.headers).toBeUndefined();
      const url = String(input);
      if (url.includes('%2Fplaylist%2F42%2Ftracks')) {
        return new Response(
          JSON.stringify({ data: [{ title: 'Song', artist: { name: 'Artist' }, readable: true }], next: null })
        );
      }
      return new Response(JSON.stringify({ title: 'My Public Playlist' }));
    }) as unknown as typeof fetch;

    const result = await fetchPlaylistFromLink({ service: 'deezer', playlistId: '42' });

    expect(result).toEqual({ name: 'My Public Playlist', lines: ['Artist - Song'] });
    expect(calls.length).toBe(2);
  });

  it('throws a friendly error for a nonexistent/private playlist', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ error: { type: 'DataException', message: 'no data', code: 800 } }))) as unknown as typeof fetch;

    await expect(fetchPlaylistFromLink({ service: 'deezer', playlistId: 'bad' })).rejects.toThrow(
      /doesn't exist or isn't public/
    );
  });

  it('throws when the playlist has no readable tracks', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('tracks')) {
        return new Response(JSON.stringify({ data: [{ title: 'Blocked', readable: false }], next: null }));
      }
      return new Response(JSON.stringify({ title: 'Empty Playlist' }));
    }) as unknown as typeof fetch;

    await expect(fetchPlaylistFromLink({ service: 'deezer', playlistId: '42' })).rejects.toThrow(/any readable tracks/);
  });
});
