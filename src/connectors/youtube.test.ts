import { describe, expect, it } from 'vitest';
import { youtubeDestination, youtubeSource } from './youtube';
import { createMockApiRequest, makeTrack } from '../test/mockApiRequest';

describe('youtubeDestination.createPlaylist', () => {
  it('maps id to a playlist URL', async () => {
    const { apiRequest } = createMockApiRequest(() => ({ id: 'PL123' }));
    const result = await youtubeDestination.createPlaylist(apiRequest, 'My Playlist', 'desc', false);
    expect(result).toEqual({ id: 'PL123', url: 'https://www.youtube.com/playlist?list=PL123' });
  });

  it('throws a friendly error when the daily quota is exhausted', async () => {
    const { apiRequest } = createMockApiRequest(() => ({ isQuotaExceeded: true }));
    await expect(youtubeDestination.createPlaylist(apiRequest, 'x', '', false)).rejects.toThrow(/quota/i);
  });
});

describe('youtubeDestination.searchTrack', () => {
  it('returns found with a constructed watch URL', async () => {
    const { apiRequest } = createMockApiRequest(() => ({
      items: [{ id: { videoId: 'v123' }, snippet: { title: 'Let It Be', channelTitle: 'The Beatles' } }],
    }));

    const result = await youtubeDestination.searchTrack(apiRequest, makeTrack('The Beatles - Let It Be', 'The Beatles', 'Let It Be'));

    expect(result).toEqual({
      status: 'found',
      externalId: 'v123',
      matchedTitle: 'Let It Be',
      matchedArtist: 'The Beatles',
      url: 'https://www.youtube.com/watch?v=v123',
      confidence: 1,
    });
  });

  it('returns needs_review when the top result is not confident enough to auto-accept', async () => {
    const { apiRequest } = createMockApiRequest(() => ({
      items: [
        { id: { videoId: 'a' }, snippet: { title: 'Let It', channelTitle: 'Some Uploader' } },
        { id: { videoId: 'b' }, snippet: { title: 'Let It Be', channelTitle: 'Some Uploader' } },
      ],
    }));

    const result = await youtubeDestination.searchTrack(apiRequest, makeTrack('The Beatles - Let It Be', 'The Beatles', 'Let It Be'));

    expect(result.status).toBe('needs_review');
    if (result.status === 'needs_review') {
      expect(result.candidates[0].externalId).toBe('b');
    }
  });

  it('returns quota_exceeded (not rate_limited) when the daily search quota is hit', async () => {
    const { apiRequest } = createMockApiRequest(() => ({ isQuotaExceeded: true }));
    const result = await youtubeDestination.searchTrack(apiRequest, makeTrack('x - y', 'x', 'y'));
    expect(result).toEqual({ status: 'quota_exceeded' });
  });

  it('returns not_found when there are no results', async () => {
    const { apiRequest } = createMockApiRequest(() => ({ items: [] }));
    const result = await youtubeDestination.searchTrack(apiRequest, makeTrack('x - y', 'x', 'y'));
    expect(result).toEqual({ status: 'not_found' });
  });

  it('retries with the remix tag stripped when the exact title returns nothing, landing in needs_review', async () => {
    const { apiRequest, calls } = createMockApiRequest((_endpoint, _options, callIndex) => {
      if (callIndex === 0) return { items: [] };
      return { items: [{ id: { videoId: 'base-track' }, snippet: { title: 'Run Away', channelTitle: 'Yellow Claw' } }] };
    });

    const result = await youtubeDestination.searchTrack(
      apiRequest,
      makeTrack('Yellow Claw - Run Away (Moksi Remix)', 'Yellow Claw', 'Run Away (Moksi Remix)')
    );

    expect(calls).toHaveLength(2);
    expect(result.status).toBe('needs_review');
    if (result.status === 'needs_review') {
      expect(result.candidates[0].externalId).toBe('base-track');
    }
  });

  it('does not retry when the title has no parenthetical content to strip', async () => {
    const { apiRequest, calls } = createMockApiRequest(() => ({ items: [] }));
    await youtubeDestination.searchTrack(apiRequest, makeTrack('x - y', 'x', 'y'));
    expect(calls).toHaveLength(1);
  });

  it('surfaces quota_exceeded hit on the retry attempt itself', async () => {
    const { apiRequest } = createMockApiRequest((_endpoint, _options, callIndex) => {
      if (callIndex === 0) return { items: [] };
      return { isQuotaExceeded: true };
    });
    const result = await youtubeDestination.searchTrack(apiRequest, makeTrack('Artist - Song (Remix)', 'Artist', 'Song (Remix)'));
    expect(result).toEqual({ status: 'quota_exceeded' });
  });
});

describe('youtubeDestination.addTracks', () => {
  it('inserts one video at a time (no bulk endpoint) and returns ok', async () => {
    const { apiRequest, calls } = createMockApiRequest(() => ({}));
    const result = await youtubeDestination.addTracks(apiRequest, 'PL1', ['v1', 'v2', 'v3']);

    expect(result).toEqual({ status: 'ok' });
    expect(calls).toHaveLength(3);
    for (const [i, videoId] of ['v1', 'v2', 'v3'].entries()) {
      const body = JSON.parse(calls[i].options!.body as string);
      expect(body.snippet.resourceId).toEqual({ kind: 'youtube#video', videoId });
      expect(body.snippet.playlistId).toBe('PL1');
    }
  });

  it('stops and reports quota_exceeded if hit partway through the loop', async () => {
    const { apiRequest, calls } = createMockApiRequest((_e, _o, callIndex) => (callIndex === 1 ? { isQuotaExceeded: true } : {}));
    const result = await youtubeDestination.addTracks(apiRequest, 'PL1', ['v1', 'v2', 'v3']);

    expect(result).toEqual({ status: 'quota_exceeded' });
    // Stops immediately on hitting the quota error rather than continuing the loop.
    expect(calls).toHaveLength(2);
  });
});

describe('youtubeSource.getPlaylistTrackLines', () => {
  it('filters out placeholder titles for deleted/private videos', async () => {
    const { apiRequest } = createMockApiRequest(() => ({
      items: [
        { snippet: { title: 'Real Song', channelTitle: 'Artist' } },
        { snippet: { title: 'Deleted video' } },
        { snippet: { title: 'Private video' } },
      ],
      nextPageToken: null,
    }));

    const lines = await youtubeSource.getPlaylistTrackLines(apiRequest, 'PL1');
    expect(lines).toEqual(['Artist - Real Song']);
  });

  it('prefers videoOwnerChannelTitle over channelTitle when both are present', async () => {
    const { apiRequest } = createMockApiRequest(() => ({
      items: [{ snippet: { title: 'Song', channelTitle: 'Uploader', videoOwnerChannelTitle: 'RealArtist' } }],
      nextPageToken: null,
    }));

    const lines = await youtubeSource.getPlaylistTrackLines(apiRequest, 'PL1');
    expect(lines).toEqual(['RealArtist - Song']);
  });
});

describe('youtubeSource.listPlaylists', () => {
  it('marks every result exportable, since mine=true only returns owned playlists', async () => {
    const { apiRequest } = createMockApiRequest(() => ({
      items: [{ id: 'PL1', snippet: { title: 'Mine' }, contentDetails: { itemCount: 4 } }],
      nextPageToken: null,
    }));

    const results = await youtubeSource.listPlaylists(apiRequest, null);
    expect(results).toEqual([{ id: 'PL1', name: 'Mine', trackCount: 4, externalUrl: 'https://www.youtube.com/playlist?list=PL1', exportable: true }]);
  });
});
