import { describe, expect, it } from 'vitest';
import { spotifyDestination, spotifySource } from './spotify';
import { createMockApiRequest, makeTrack } from '../test/mockApiRequest';

describe('spotifyDestination.createPlaylist', () => {
  it('maps id and external_urls.spotify to {id, url}', async () => {
    const { apiRequest, calls } = createMockApiRequest(() => ({
      id: 'pl123',
      external_urls: { spotify: 'https://open.spotify.com/playlist/pl123' },
    }));

    const result = await spotifyDestination.createPlaylist(apiRequest, 'My Playlist', 'desc', true);

    expect(result).toEqual({ id: 'pl123', url: 'https://open.spotify.com/playlist/pl123' });
    expect(calls[0].endpoint).toBe('/me/playlists');
    expect(JSON.parse(calls[0].options!.body as string)).toEqual({ name: 'My Playlist', description: 'desc', public: true });
  });
});

describe('spotifyDestination.searchTrack', () => {
  it('returns found with mapped fields when a track matches', async () => {
    const { apiRequest } = createMockApiRequest(() => ({
      tracks: {
        items: [
          {
            uri: 'spotify:track:abc',
            name: 'Let It Be',
            artists: [{ name: 'The Beatles' }],
            external_urls: { spotify: 'https://open.spotify.com/track/abc' },
          },
        ],
      },
    }));

    const result = await spotifyDestination.searchTrack(apiRequest, makeTrack('The Beatles - Let It Be', 'The Beatles', 'Let It Be'));

    expect(result).toEqual({
      status: 'found',
      externalId: 'spotify:track:abc',
      matchedTitle: 'Let It Be',
      matchedArtist: 'The Beatles',
      url: 'https://open.spotify.com/track/abc',
      confidence: 1,
    });
  });

  it('returns not_found when there are no matching tracks', async () => {
    const { apiRequest } = createMockApiRequest(() => ({ tracks: { items: [] } }));
    const result = await spotifyDestination.searchTrack(apiRequest, makeTrack('x - y', 'x', 'y'));
    expect(result).toEqual({ status: 'not_found' });
  });

  it('returns needs_review with multiple candidates when nothing scores high enough to auto-accept', async () => {
    const { apiRequest } = createMockApiRequest(() => ({
      tracks: {
        items: [
          { uri: 'a', name: 'Let It', artists: [{ name: 'Cover Band' }], external_urls: { spotify: 'x' } },
          { uri: 'b', name: 'Let It Be', artists: [{ name: 'Cover Band' }], external_urls: { spotify: 'y' } },
        ],
      },
    }));

    const result = await spotifyDestination.searchTrack(apiRequest, makeTrack('The Beatles - Let It Be', 'The Beatles', 'Let It Be'));

    expect(result.status).toBe('needs_review');
    if (result.status === 'needs_review') {
      expect(result.candidates[0].externalId).toBe('b'); // best match sorted first
    }
  });

  it('surfaces a rate-limited response from apiRequest as status rate_limited', async () => {
    const { apiRequest } = createMockApiRequest(() => ({ isRateLimited: true, waitSeconds: 12 }));
    const result = await spotifyDestination.searchTrack(apiRequest, makeTrack('x - y', 'x', 'y'));
    expect(result).toEqual({ status: 'rate_limited', waitSeconds: 12 });
  });

  it('retries with the remix tag stripped when the exact title returns nothing, landing in needs_review even at high confidence', async () => {
    const { apiRequest, calls } = createMockApiRequest((_endpoint, _options, callIndex) => {
      if (callIndex === 0) return { tracks: { items: [] } }; // exact "(Moksi Remix)" title: nothing
      return {
        tracks: {
          items: [
            { uri: 'base-track', name: 'Run Away', artists: [{ name: 'Yellow Claw' }], external_urls: { spotify: 'x' } },
          ],
        },
      };
    });

    const result = await spotifyDestination.searchTrack(
      apiRequest,
      makeTrack('Yellow Claw - Run Away (Moksi Remix)', 'Yellow Claw', 'Run Away (Moksi Remix)')
    );

    expect(calls).toHaveLength(2);
    expect(decodeURIComponent(calls[1].endpoint)).toContain('track:Run Away');
    expect(result.status).toBe('needs_review');
    if (result.status === 'needs_review') {
      expect(result.candidates[0].externalId).toBe('base-track');
    }
  });

  it('does not retry when the title has no parenthetical content to strip', async () => {
    const { apiRequest, calls } = createMockApiRequest(() => ({ tracks: { items: [] } }));
    const result = await spotifyDestination.searchTrack(apiRequest, makeTrack('x - y', 'x', 'y'));
    expect(calls).toHaveLength(1);
    expect(result).toEqual({ status: 'not_found' });
  });

  it('stays not_found when the simplified retry also comes up empty', async () => {
    const { apiRequest, calls } = createMockApiRequest(() => ({ tracks: { items: [] } }));
    const result = await spotifyDestination.searchTrack(
      apiRequest,
      makeTrack('Artist - Song (Some Rare Remix)', 'Artist', 'Song (Some Rare Remix)')
    );
    expect(calls).toHaveLength(2);
    expect(result).toEqual({ status: 'not_found' });
  });

  it('surfaces a rate limit hit on the retry attempt itself, not just the first one', async () => {
    const { apiRequest } = createMockApiRequest((_endpoint, _options, callIndex) => {
      if (callIndex === 0) return { tracks: { items: [] } };
      return { isRateLimited: true, waitSeconds: 5 };
    });
    const result = await spotifyDestination.searchTrack(
      apiRequest,
      makeTrack('Artist - Song (Remix)', 'Artist', 'Song (Remix)')
    );
    expect(result).toEqual({ status: 'rate_limited', waitSeconds: 5 });
  });
});

describe('spotifyDestination.addTracks', () => {
  it('sends externalIds as uris and returns ok', async () => {
    const { apiRequest, calls } = createMockApiRequest(() => ({}));
    const result = await spotifyDestination.addTracks(apiRequest, 'pl1', ['spotify:track:a', 'spotify:track:b']);

    expect(result).toEqual({ status: 'ok' });
    expect(calls[0].endpoint).toBe('/playlists/pl1/items');
    expect(JSON.parse(calls[0].options!.body as string)).toEqual({ uris: ['spotify:track:a', 'spotify:track:b'] });
  });
});

describe('spotifySource.listPlaylists', () => {
  it('paginates via next and marks ownership/collaborative playlists exportable', async () => {
    const { apiRequest } = createMockApiRequest((endpoint) => {
      if (endpoint === '/me/playlists?limit=50') {
        return {
          items: [
            { id: 'p1', name: 'Mine', items: { total: 3 }, owner: { id: 'me' }, collaborative: false },
            { id: 'p2', name: 'Shared', owner: { id: 'other' }, collaborative: true },
            { id: 'p3', name: 'NotMine', tracks: { total: 5 }, owner: { id: 'other' }, collaborative: false },
          ],
          next: '/me/playlists?limit=50&offset=50',
        };
      }
      return { items: [{ id: 'p4', name: 'Page2', items: { total: 1 }, owner: { id: 'me' }, collaborative: false }], next: null };
    });

    const results = await spotifySource.listPlaylists(apiRequest, 'me');

    expect(results.map((r) => r.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(results[0]).toMatchObject({ exportable: true, trackCount: 3 });
    expect(results[1]).toMatchObject({ exportable: true }); // collaborative
    expect(results[2]).toMatchObject({ exportable: false, trackCount: 5 }); // deprecated "tracks" field fallback
    expect(results[2].unexportableReason).toBeTruthy();
  });
});

describe('spotifySource.getPlaylistTrackLines', () => {
  it('reads the current "item" field and falls back to the deprecated "track" field', async () => {
    const { apiRequest } = createMockApiRequest(() => ({
      items: [
        { item: { name: 'Song A', artists: [{ name: 'Artist A' }] } },
        { track: { name: 'Song B', artists: [{ name: 'Artist B' }] } },
        { item: null }, // removed/local track
      ],
      next: null,
    }));

    const lines = await spotifySource.getPlaylistTrackLines(apiRequest, 'pl1');
    expect(lines).toEqual(['Artist A - Song A', 'Artist B - Song B']);
  });

  it('paginates via next until it is null', async () => {
    const { apiRequest, calls } = createMockApiRequest((endpoint) => {
      if (endpoint === '/playlists/pl1/items?limit=100') {
        return { items: [{ item: { name: 'One', artists: [] } }], next: '/playlists/pl1/items?limit=100&offset=100' };
      }
      return { items: [{ item: { name: 'Two', artists: [] } }], next: null };
    });

    const lines = await spotifySource.getPlaylistTrackLines(apiRequest, 'pl1');
    expect(lines).toEqual(['One', 'Two']);
    expect(calls).toHaveLength(2);
  });
});
