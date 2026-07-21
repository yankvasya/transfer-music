import type { DestinationConnector, SourceConnector } from './types';
import { selectMatch, stripParentheticals } from '../utils/matching';

// Yandex's playlist mutation endpoint identifies a track by BOTH its id and its album id
// (no fallback if album id is omitted), but this app's connector interfaces only carry a
// single `externalId` string per track. Pack both into one string and unpack on the way
// back out, rather than widening the shared interface for one service's quirk.
function packTrackId(id: string | number, albumId: string | number): string {
  return `${id}:${albumId}`;
}
function unpackTrackId(packed: string): { id: string; albumId: string } {
  const [id, albumId] = packed.split(':');
  return { id, albumId };
}

// A Yandex playlist is scoped to its owner (/users/{uid}/playlists/{kind}), so the
// connector interfaces' single `playlistId` string packs both parts the same way.
function packPlaylistId(uid: string | number, kind: string | number): string {
  return `${uid}:${kind}`;
}
function unpackPlaylistId(packed: string): { uid: string; kind: string } {
  const [uid, kind] = packed.split(':');
  return { uid, kind };
}

export const yandexDestination: DestinationConnector = {
  id: 'yandex-music',
  label: 'Yandex Music',
  batchSize: 50, // no documented cap on diff batch size; kept moderate to be safe

  async createPlaylist(apiRequest, name, _description, isPublic) {
    // No "current user" shortcut endpoint like Spotify's /me/playlists — need the uid
    // explicitly to build the create URL.
    const status = await apiRequest('/account/status');
    const uid = status?.account?.uid;
    if (!uid) throw new Error('Could not determine your Yandex Music account id.');

    // Yandex playlists have no description field, so it's silently dropped here.
    const body = new URLSearchParams({ title: name, visibility: isPublic ? 'public' : 'private' });
    const playlist = await apiRequest(`/users/${uid}/playlists/create`, {
      method: 'POST',
      body: body.toString(),
    });

    return {
      id: packPlaylistId(uid, playlist.kind),
      url: `https://music.yandex.ru/users/${uid}/playlists/${playlist.kind}`,
    };
  },

  async searchTrack(apiRequest, track) {
    const search = async (title: string) => {
      const query = track.artist ? `${track.artist} ${title}` : title;
      const res = await apiRequest(
        `/search?text=${encodeURIComponent(query)}&nocorrect=false&type=track&page=0&playlist-in-best=true`
      );
      if (res && res.isRateLimited) {
        return { ok: false as const, waitSeconds: res.waitSeconds };
      }
      const results = res?.tracks?.results || [];
      // Playlist mutation needs an album id alongside the track id, so skip any result
      // that doesn't have one (or is marked unavailable) before it's even a candidate.
      const usable = results.filter((t: any) => t.available !== false && t.albums?.[0]?.id != null);
      return {
        ok: true as const,
        candidates: usable.map((t: any) => {
          const albumId = t.albums[0].id;
          return {
            externalId: packTrackId(t.id, albumId),
            title: t.title,
            artist: (t.artists || []).map((a: any) => a.name).join(', '),
            url: `https://music.yandex.ru/album/${albumId}/track/${t.id}`,
          };
        }),
      };
    };

    const first = await search(track.title);
    if (!first.ok) return { status: 'rate_limited' as const, waitSeconds: first.waitSeconds };

    let result = selectMatch(track, first.candidates);

    // A remix/version tag the exact search didn't turn up anything for — retry once with
    // it stripped out before giving up, so the base track at least surfaces for review
    // instead of a flat "not found".
    if (result.status === 'not_found') {
      const simplified = stripParentheticals(track.title);
      if (simplified && simplified !== track.title) {
        const second = await search(simplified);
        if (!second.ok) return { status: 'rate_limited' as const, waitSeconds: second.waitSeconds };
        result = selectMatch(track, second.candidates, { forceReview: true });
      }
    }

    return result;
  },

  async addTracks(apiRequest, playlistId, externalIds) {
    const { uid, kind } = unpackPlaylistId(playlistId);

    // Fetch the current revision fresh right before mutating, rather than tracking it
    // across calls, since this is the safe choice against any concurrent change.
    const playlist = await apiRequest(`/users/${uid}/playlists/${kind}`);
    if (playlist && playlist.isRateLimited) {
      return { status: 'rate_limited', waitSeconds: playlist.waitSeconds };
    }

    const at = playlist.trackCount ?? playlist.tracks?.length ?? 0;
    const tracks = externalIds.map((packed) => {
      const { id, albumId } = unpackTrackId(packed);
      return { id, albumId };
    });
    const diff = JSON.stringify([{ op: 'insert', at, tracks }]);

    const body = new URLSearchParams({ kind: String(kind), revision: String(playlist.revision), diff });
    const res = await apiRequest(`/users/${uid}/playlists/${kind}/change`, {
      method: 'POST',
      body: body.toString(),
    });

    if (res && res.isRateLimited) {
      return { status: 'rate_limited', waitSeconds: res.waitSeconds };
    }
    return { status: 'ok' };
  },
};

export const yandexSource: SourceConnector = {
  id: 'yandex-music',
  label: 'Yandex Music',

  async listPlaylists(apiRequest, currentUserId) {
    if (!currentUserId) return [];

    const playlists = await apiRequest(`/users/${currentUserId}/playlists/list`);
    return (Array.isArray(playlists) ? playlists : []).map((p: any) => ({
      id: packPlaylistId(currentUserId, p.kind),
      name: p.title ?? 'Untitled playlist',
      trackCount: p.trackCount ?? 0,
      externalUrl: `https://music.yandex.ru/users/${currentUserId}/playlists/${p.kind}`,
      // This only ever lists the current user's own playlists, so all are exportable.
      exportable: true,
    }));
  },

  async getPlaylistName(apiRequest, playlistId) {
    const { uid, kind } = unpackPlaylistId(playlistId);
    const playlist = await apiRequest(`/users/${uid}/playlists/${kind}`);
    return playlist?.title ?? 'Untitled playlist';
  },

  async getPlaylistTrackLines(apiRequest, playlistId) {
    const { uid, kind } = unpackPlaylistId(playlistId);
    const playlist = await apiRequest(`/users/${uid}/playlists/${kind}`);

    const lines: string[] = [];
    for (const entry of playlist?.tracks || []) {
      const track = entry.track;
      if (!track || track.available === false) continue;
      const artists = (track.artists || []).map((a: any) => a.name).join(', ');
      lines.push(artists ? `${artists} - ${track.title}` : track.title);
    }
    return lines;
  },
};
