import { describe, expect, it } from 'vitest';
import { deezerDestination, deezerSource } from './deezer';
import { createMockApiRequest, makeTrack } from '../test/mockApiRequest';

describe('deezerDestination.createPlaylist', () => {
  it('maps id to a playlist URL', async () => {
    const { apiRequest, calls } = createMockApiRequest(() => ({ id: 999 }));
    const result = await deezerDestination.createPlaylist(apiRequest, 'My Playlist', 'ignored desc', true);

    expect(result).toEqual({ id: '999', url: 'https://www.deezer.com/playlist/999' });
    const body = new URLSearchParams(calls[0].options!.body as string);
    expect(body.get('title')).toBe('My Playlist');
    expect(body.get('public')).toBe('true');
  });

  it('throws when rate-limited, since there is no batch to retry later here', async () => {
    const { apiRequest } = createMockApiRequest(() => ({ isRateLimited: true, waitSeconds: 5 }));
    await expect(deezerDestination.createPlaylist(apiRequest, 'x', '', false)).rejects.toThrow(/rate limit/i);
  });
});

describe('deezerDestination.searchTrack', () => {
  it('returns found for the first readable result', async () => {
    const { apiRequest } = createMockApiRequest(() => ({
      data: [{ id: 123, title: 'Song', artist: { name: 'Artist' }, link: 'https://deezer.com/track/123', readable: true }],
    }));

    const result = await deezerDestination.searchTrack(apiRequest, makeTrack('Artist - Song', 'Artist', 'Song'));
    expect(result).toEqual({ status: 'found', externalId: '123', matchedTitle: 'Song', matchedArtist: 'Artist', url: 'https://deezer.com/track/123', confidence: 1 });
  });

  it('skips unreadable results', async () => {
    const { apiRequest } = createMockApiRequest(() => ({ data: [{ id: 1, title: 'X', readable: false }] }));
    const result = await deezerDestination.searchTrack(apiRequest, makeTrack('x - y', 'x', 'y'));
    expect(result).toEqual({ status: 'not_found' });
  });

  it('returns needs_review with multiple candidates when nothing is confident enough to auto-accept', async () => {
    const { apiRequest } = createMockApiRequest(() => ({
      data: [
        { id: 1, title: 'Song', artist: { name: 'Cover Artist' }, link: 'x', readable: true },
        { id: 2, title: 'Song Live', artist: { name: 'Cover Artist' }, link: 'y', readable: true },
      ],
    }));

    const result = await deezerDestination.searchTrack(apiRequest, makeTrack('Original Artist - Song', 'Original Artist', 'Song'));

    expect(result.status).toBe('needs_review');
    if (result.status === 'needs_review') {
      expect(result.candidates[0].externalId).toBe('1');
    }
  });
});

describe('deezerDestination.addTracks', () => {
  it('joins externalIds into a comma-separated songs param', async () => {
    const { apiRequest, calls } = createMockApiRequest(() => true);
    const result = await deezerDestination.addTracks(apiRequest, '999', ['1', '2', '3']);

    expect(result).toEqual({ status: 'ok' });
    expect(calls[0].endpoint).toBe('/playlist/999/tracks');
    const body = new URLSearchParams(calls[0].options!.body as string);
    expect(body.get('songs')).toBe('1,2,3');
  });
});

describe('deezerSource.listPlaylists', () => {
  it('paginates by stripping the API host from the absolute next URL', async () => {
    const { apiRequest, calls } = createMockApiRequest((endpoint) => {
      if (endpoint === '/user/me/playlists') {
        return { data: [{ id: 1, title: 'A', nb_tracks: 2, link: 'https://deezer.com/1', creator: { id: 555 } }], next: 'https://api.deezer.com/user/me/playlists?index=25' };
      }
      return { data: [{ id: 2, title: 'B', nb_tracks: 1, link: 'https://deezer.com/2', creator: { id: 999 } }], next: null };
    });

    const results = await deezerSource.listPlaylists(apiRequest, '555');

    expect(calls.map((c) => c.endpoint)).toEqual(['/user/me/playlists', '/user/me/playlists?index=25']);
    expect(results[0]).toMatchObject({ id: '1', exportable: true });
    expect(results[1]).toMatchObject({ id: '2', exportable: false });
    expect(results[1].unexportableReason).toBeTruthy();
  });
});

describe('deezerSource.getPlaylistTrackLines', () => {
  it('filters out unreadable tracks', async () => {
    const { apiRequest } = createMockApiRequest(() => ({
      data: [
        { title: 'Song A', artist: { name: 'Artist A' }, readable: true },
        { title: 'Blocked', artist: { name: 'X' }, readable: false },
      ],
      next: null,
    }));

    const lines = await deezerSource.getPlaylistTrackLines(apiRequest, '999');
    expect(lines).toEqual(['Artist A - Song A']);
  });
});
