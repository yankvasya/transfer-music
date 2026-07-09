import type { DestinationConnector, SourceConnector } from './types';

const API_BASE = 'https://api.deezer.com';

// Deezer's `next` pagination field is a full absolute URL rather than a path/token, but
// this app's apiRequest wrapper (routed through /api/deezer-data?path=) expects just the
// path+query. Strip the known API host if present so the loop can keep passing `next`
// straight back into apiRequest.
function toPath(next: string): string {
  return next.startsWith(API_BASE) ? next.slice(API_BASE.length) : next;
}

export const deezerDestination: DestinationConnector = {
  id: 'deezer',
  label: 'Deezer',
  batchSize: 25, // no confirmed hard limit; kept moderate since ITEMS_LIMIT_EXCEEDED exists but its threshold isn't documented

  async createPlaylist(apiRequest, name, _description, isPublic) {
    const body = new URLSearchParams({ title: name, public: String(isPublic) });
    const res = await apiRequest('/user/me/playlists', {
      method: 'POST',
      body: body.toString(),
    });

    if (res && res.isRateLimited) {
      throw new Error("Deezer's rate limit was hit while creating the playlist — try again shortly.");
    }

    return { id: String(res.id), url: `https://www.deezer.com/playlist/${res.id}` };
  },

  async searchTrack(apiRequest, track) {
    const query = track.artist ? `${track.artist} ${track.title}` : track.title;
    const res = await apiRequest(`/search?q=${encodeURIComponent(query)}`);

    if (res && res.isRateLimited) {
      return { status: 'rate_limited', waitSeconds: res.waitSeconds };
    }

    const match = (res?.data || []).find((t: any) => t.readable !== false);
    if (!match) return { status: 'not_found' };

    return {
      status: 'found',
      externalId: String(match.id),
      matchedTitle: match.title,
      matchedArtist: match.artist?.name ?? '',
      url: match.link,
    };
  },

  async addTracks(apiRequest, playlistId, externalIds) {
    const body = new URLSearchParams({ songs: externalIds.join(',') });
    const res = await apiRequest(`/playlist/${playlistId}/tracks`, {
      method: 'POST',
      body: body.toString(),
    });

    if (res && res.isRateLimited) {
      return { status: 'rate_limited', waitSeconds: res.waitSeconds };
    }
    return { status: 'ok' };
  },
};

export const deezerSource: SourceConnector = {
  id: 'deezer',
  label: 'Deezer',

  async listPlaylists(apiRequest, currentUserId) {
    const results: ReturnType<typeof mapPlaylist>[] = [];
    let endpoint: string | null = '/user/me/playlists';

    while (endpoint) {
      const data = await apiRequest(endpoint);
      for (const p of data.data || []) {
        results.push(mapPlaylist(p, currentUserId));
      }
      endpoint = data.next ? toPath(data.next) : null;
    }

    return results;
  },

  async getPlaylistName(apiRequest, playlistId) {
    const playlist = await apiRequest(`/playlist/${playlistId}`);
    return playlist?.title ?? 'Untitled playlist';
  },

  async getPlaylistTrackLines(apiRequest, playlistId) {
    const lines: string[] = [];
    let endpoint: string | null = `/playlist/${playlistId}/tracks`;

    while (endpoint) {
      const data = await apiRequest(endpoint);
      for (const track of data.data || []) {
        if (track.readable === false) continue;
        const artist = track.artist?.name;
        lines.push(artist ? `${artist} - ${track.title}` : track.title);
      }
      endpoint = data.next ? toPath(data.next) : null;
    }

    return lines;
  },
};

function mapPlaylist(p: any, currentUserId: string | null) {
  const exportable = String(p.creator?.id) === currentUserId;
  return {
    id: String(p.id),
    name: p.title as string,
    trackCount: p.nb_tracks ?? 0,
    externalUrl: p.link as string,
    exportable,
    unexportableReason: exportable
      ? undefined
      : "This playlist belongs to someone else, so Deezer won't let this app read its tracks. Open it in Deezer, duplicate it to your own library, then export that copy instead.",
  };
}
