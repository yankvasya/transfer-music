import type { DestinationConnector, SourceConnector } from './types';
import { selectMatch, stripParentheticals } from '../utils/matching';

export const youtubeDestination: DestinationConnector = {
  id: 'youtube',
  label: 'YouTube',
  batchSize: 1, // playlistItems.insert only ever accepts a single video per call

  async createPlaylist(apiRequest, name, description, isPublic) {
    const data = await apiRequest('/playlists?part=snippet,status', {
      method: 'POST',
      body: JSON.stringify({
        snippet: { title: name, description },
        status: { privacyStatus: isPublic ? 'public' : 'private' },
      }),
    });

    if (data && data.isQuotaExceeded) {
      throw new Error(
        "YouTube's daily API quota is exhausted, so a playlist couldn't even be created yet. It resets at midnight Pacific Time — try again after that."
      );
    }

    return { id: data.id, url: `https://www.youtube.com/playlist?list=${data.id}` };
  },

  async searchTrack(apiRequest, track) {
    const search = async (title: string) => {
      const query = track.artist ? `${track.artist} ${title}` : title;
      const res = await apiRequest(`/search?part=snippet&type=video&maxResults=5&q=${encodeURIComponent(query)}`);
      if (res && res.isQuotaExceeded) {
        return { ok: false as const };
      }
      const items = res?.items || [];
      // The channel name (e.g. "Adele - Topic", "Some VEVO") is a noisy stand-in for the
      // actual artist, but it's the only per-result signal YouTube's search gives —
      // scoring it low just means a track lands in review instead of wrongly
      // auto-accepting, which is the safe direction for that noise to push things.
      return {
        ok: true as const,
        candidates: items.map((item: any) => ({
          externalId: item.id.videoId,
          title: item.snippet.title,
          artist: item.snippet.channelTitle,
          url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        })),
      };
    };

    const first = await search(track.title);
    if (!first.ok) return { status: 'quota_exceeded' as const };

    let result = selectMatch(track, first.candidates);

    // A remix/version tag the exact search didn't turn up anything for — retry once with
    // it stripped out before giving up, so the base track at least surfaces for review
    // instead of a flat "not found".
    if (result.status === 'not_found') {
      const simplified = stripParentheticals(track.title);
      if (simplified && simplified !== track.title) {
        const second = await search(simplified);
        if (!second.ok) return { status: 'quota_exceeded' as const };
        result = selectMatch(track, second.candidates, { forceReview: true });
      }
    }

    return result;
  },

  async addTracks(apiRequest, playlistId, externalIds) {
    // No bulk endpoint — insert one at a time (matches batchSize: 1 above).
    for (const videoId of externalIds) {
      const res = await apiRequest('/playlistItems?part=snippet', {
        method: 'POST',
        body: JSON.stringify({
          snippet: { playlistId, resourceId: { kind: 'youtube#video', videoId } },
        }),
      });

      if (res && res.isQuotaExceeded) {
        return { status: 'quota_exceeded' };
      }
    }
    return { status: 'ok' };
  },
};

export const youtubeSource: SourceConnector = {
  id: 'youtube',
  label: 'YouTube',

  async listPlaylists(apiRequest) {
    const results: { id: string; name: string; trackCount: number; externalUrl: string; exportable: true }[] = [];
    let endpoint: string | null = '/playlists?part=snippet,contentDetails&mine=true&maxResults=50';

    while (endpoint) {
      const data = await apiRequest(endpoint);
      for (const p of data.items || []) {
        // mine=true only ever returns playlists you own, so every result is exportable —
        // unlike Spotify's list, which also includes followed/saved playlists.
        results.push({
          id: p.id,
          name: p.snippet?.title ?? 'Untitled playlist',
          trackCount: p.contentDetails?.itemCount ?? 0,
          externalUrl: `https://www.youtube.com/playlist?list=${p.id}`,
          exportable: true,
        });
      }
      endpoint = data.nextPageToken
        ? `/playlists?part=snippet,contentDetails&mine=true&maxResults=50&pageToken=${data.nextPageToken}`
        : null;
    }

    return results;
  },

  async getPlaylistName(apiRequest, playlistId) {
    const data = await apiRequest(`/playlists?part=snippet&id=${playlistId}`);
    return data.items?.[0]?.snippet?.title ?? 'Untitled playlist';
  },

  async getPlaylistTrackLines(apiRequest, playlistId) {
    const lines: string[] = [];
    let endpoint: string | null = `/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50`;

    while (endpoint) {
      const data = await apiRequest(endpoint);
      for (const entry of data.items || []) {
        const snippet = entry.snippet;
        // A deleted/private video still shows up as an item with a placeholder title.
        if (!snippet || snippet.title === 'Deleted video' || snippet.title === 'Private video') continue;
        const artist = snippet.videoOwnerChannelTitle || snippet.channelTitle;
        lines.push(artist ? `${artist} - ${snippet.title}` : snippet.title);
      }
      endpoint = data.nextPageToken
        ? `/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&pageToken=${data.nextPageToken}`
        : null;
    }

    return lines;
  },
};
