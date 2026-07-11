import { describe, expect, it } from 'vitest';
import { yandexDestination, yandexSource } from './yandex';
import { createMockApiRequest, makeTrack } from '../test/mockApiRequest';

describe('yandexDestination.createPlaylist', () => {
  it('resolves uid via /account/status, then packs uid:kind as the playlist id', async () => {
    const { apiRequest, calls } = createMockApiRequest((endpoint) => {
      if (endpoint === '/account/status') return { account: { uid: 555 } };
      return { kind: 42 };
    });

    const result = await yandexDestination.createPlaylist(apiRequest, 'My Playlist', 'ignored desc', true);

    expect(result).toEqual({ id: '555:42', url: 'https://music.yandex.ru/users/555/playlists/42' });
    expect(calls[1].endpoint).toBe('/users/555/playlists/create');
    const body = new URLSearchParams(calls[1].options!.body as string);
    expect(body.get('title')).toBe('My Playlist');
    expect(body.get('visibility')).toBe('public');
  });

  it('throws when the account status has no uid', async () => {
    const { apiRequest } = createMockApiRequest(() => ({ account: {} }));
    await expect(yandexDestination.createPlaylist(apiRequest, 'x', '', false)).rejects.toThrow(/account id/i);
  });
});

describe('yandexDestination.searchTrack', () => {
  it('packs the matched track id and album id together as externalId', async () => {
    const { apiRequest } = createMockApiRequest(() => ({
      tracks: { results: [{ id: 111, title: 'Song', artists: [{ name: 'Artist' }], albums: [{ id: 222 }], available: true }] },
    }));

    const result = await yandexDestination.searchTrack(apiRequest, makeTrack('Artist - Song', 'Artist', 'Song'));

    expect(result).toMatchObject({ status: 'found', externalId: '111:222', matchedArtist: 'Artist' });
  });

  it('returns needs_review with multiple candidates when nothing is confident enough to auto-accept', async () => {
    const { apiRequest } = createMockApiRequest(() => ({
      tracks: {
        results: [
          { id: 1, title: 'Song', artists: [{ name: 'Cover Artist' }], albums: [{ id: 10 }], available: true },
          { id: 2, title: 'Song Live', artists: [{ name: 'Cover Artist' }], albums: [{ id: 20 }], available: true },
        ],
      },
    }));

    const result = await yandexDestination.searchTrack(apiRequest, makeTrack('Original Artist - Song', 'Original Artist', 'Song'));

    expect(result.status).toBe('needs_review');
    if (result.status === 'needs_review') {
      expect(result.candidates[0].externalId).toBe('1:10'); // exact title match ranks above the "Live" variant
    }
  });

  it('skips a result with no album id, even if otherwise available', async () => {
    const { apiRequest } = createMockApiRequest(() => ({
      tracks: { results: [{ id: 111, title: 'Song', artists: [], albums: [], available: true }] },
    }));

    const result = await yandexDestination.searchTrack(apiRequest, makeTrack('x - y', 'x', 'y'));
    expect(result).toEqual({ status: 'not_found' });
  });

  it('skips unavailable tracks', async () => {
    const { apiRequest } = createMockApiRequest(() => ({
      tracks: { results: [{ id: 1, title: 'X', artists: [], albums: [{ id: 2 }], available: false }] },
    }));

    const result = await yandexDestination.searchTrack(apiRequest, makeTrack('x - y', 'x', 'y'));
    expect(result).toEqual({ status: 'not_found' });
  });
});

describe('yandexDestination.addTracks', () => {
  it('fetches the current revision, then submits a diff with unpacked id/albumId pairs', async () => {
    const { apiRequest, calls } = createMockApiRequest((endpoint) => {
      if (endpoint === '/users/555/playlists/42') return { revision: 7, trackCount: 3 };
      return {};
    });

    const result = await yandexDestination.addTracks(apiRequest, '555:42', ['111:222', '333:444']);

    expect(result).toEqual({ status: 'ok' });
    expect(calls[1].endpoint).toBe('/users/555/playlists/42/change');
    const body = new URLSearchParams(calls[1].options!.body as string);
    expect(body.get('kind')).toBe('42');
    expect(body.get('revision')).toBe('7');
    expect(JSON.parse(body.get('diff')!)).toEqual([
      { op: 'insert', at: 3, tracks: [{ id: '111', albumId: '222' }, { id: '333', albumId: '444' }] },
    ]);
  });
});

describe('yandexSource.listPlaylists', () => {
  it('returns an empty array without calling apiRequest when there is no current user id', async () => {
    const { apiRequest, calls } = createMockApiRequest(() => []);
    const result = await yandexSource.listPlaylists(apiRequest, null);
    expect(result).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('marks every playlist exportable, since this only lists the current user\'s own playlists', async () => {
    const { apiRequest } = createMockApiRequest(() => [{ kind: 1, title: 'My Playlist', trackCount: 5 }]);
    const result = await yandexSource.listPlaylists(apiRequest, '555');
    expect(result).toEqual([
      { id: '555:1', name: 'My Playlist', trackCount: 5, externalUrl: 'https://music.yandex.ru/users/555/playlists/1', exportable: true },
    ]);
  });
});

describe('yandexSource.getPlaylistTrackLines', () => {
  it('filters out unavailable and missing tracks', async () => {
    const { apiRequest } = createMockApiRequest(() => ({
      tracks: [
        { track: { title: 'Song A', artists: [{ name: 'Artist A' }], available: true } },
        { track: { title: 'Gone', artists: [], available: false } },
        { track: null },
      ],
    }));

    const lines = await yandexSource.getPlaylistTrackLines(apiRequest, '555:42');
    expect(lines).toEqual(['Artist A - Song A']);
  });
});
