import type { DestinationConnector, SourceConnector } from './types';
import { selectMatch } from '../utils/matching';

export const spotifyDestination: DestinationConnector = {
  id: 'spotify',
  label: 'Spotify',
  batchSize: 100, // max URIs per POST /playlists/{id}/items call

  async createPlaylist(apiRequest, name, description, isPublic) {
    const data = await apiRequest('/me/playlists', {
      method: 'POST',
      body: JSON.stringify({ name, description, public: isPublic }),
    });
    return { id: data.id, url: data.external_urls.spotify };
  },

  async searchTrack(apiRequest, track) {
    const query = track.artist ? `artist:${track.artist} track:${track.title}` : track.title;
    const res = await apiRequest(`/search?q=${encodeURIComponent(query)}&type=track&limit=5`);

    if (res && res.isRateLimited) {
      return { status: 'rate_limited', waitSeconds: res.waitSeconds };
    }

    const items = res?.tracks?.items || [];
    const candidates = items.map((item: any) => ({
      externalId: item.uri,
      title: item.name,
      artist: (item.artists || []).map((a: any) => a.name).join(', '),
      url: item.external_urls.spotify,
    }));

    return selectMatch(track, candidates);
  },

  async addTracks(apiRequest, playlistId, externalIds) {
    const res = await apiRequest(`/playlists/${playlistId}/items`, {
      method: 'POST',
      body: JSON.stringify({ uris: externalIds }),
    });

    if (res && res.isRateLimited) {
      return { status: 'rate_limited', waitSeconds: res.waitSeconds };
    }
    return { status: 'ok' };
  },
};

export const spotifySource: SourceConnector = {
  id: 'spotify',
  label: 'Spotify',

  async listPlaylists(apiRequest, currentUserId) {
    const results: ReturnType<typeof mapPlaylist>[] = [];
    let endpoint: string | null = '/me/playlists?limit=50';

    while (endpoint) {
      const data = await apiRequest(endpoint);
      for (const p of data.items || []) {
        results.push(mapPlaylist(p, currentUserId));
      }
      endpoint = data.next;
    }

    return results;
  },

  async getPlaylistName(apiRequest, playlistId) {
    const meta = await apiRequest(`/playlists/${playlistId}?fields=name`);
    return meta.name;
  },

  async getPlaylistTrackLines(apiRequest, playlistId) {
    const lines: string[] = [];
    let endpoint: string | null = `/playlists/${playlistId}/items?limit=100`;

    while (endpoint) {
      const data = await apiRequest(endpoint);
      for (const entry of data.items || []) {
        // "item" is the current field name; "track" is Spotify's deprecated alias for it.
        const track = entry.item ?? entry.track;
        if (!track) continue; // removed/local tracks come back null
        const artists = (track.artists || []).map((a: any) => a.name).join(', ');
        lines.push(artists ? `${artists} - ${track.name}` : track.name);
      }
      endpoint = data.next;
    }

    return lines;
  },
};

function mapPlaylist(p: any, currentUserId: string | null) {
  // Reading items is only allowed for playlists you own or collaborate on —
  // anything else (followed/saved playlists) will 403 if you try.
  const exportable = p.owner?.id === currentUserId || p.collaborative === true;
  return {
    id: p.id as string,
    name: p.name as string,
    // "items" is the current field name; "tracks" is Spotify's deprecated alias for it.
    trackCount: p.items?.total ?? p.tracks?.total ?? 0,
    externalUrl: `https://open.spotify.com/playlist/${p.id}`,
    exportable,
    unexportableReason: exportable
      ? undefined
      : "This playlist belongs to someone else, so Spotify won't let this app read its tracks. Open it in Spotify, use '...' -> 'Add to other playlist' -> 'New Playlist' to make your own copy, then export that copy instead.",
  };
}
