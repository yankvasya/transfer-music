import { deezerSource } from '../connectors/deezer';
import type { DetectedPlaylistLink } from './playlistLink';

const DATA_PROXY = '/api/deezer-data';

// Deezer's public playlist data needs no access_token at all — the proxy already treats it
// as optional (see api/deezer-data.ts), so simply never sending an Authorization header is
// enough to read a public playlist's name and tracks with nobody logged in.
async function deezerAnonymousApiRequest(endpoint: string): Promise<any> {
  const response = await fetch(`${DATA_PROXY}?path=${encodeURIComponent(endpoint)}`);
  const data = await response.json();

  if (data && data.error) {
    if (data.error.code === 800) {
      throw new Error("That playlist doesn't exist or isn't public.");
    }
    throw new Error(`Deezer error [${data.error.code}]: ${data.error.message || data.error.type}`);
  }

  return data;
}

export async function fetchPlaylistFromLink(link: DetectedPlaylistLink): Promise<{ name: string; lines: string[] }> {
  const name = await deezerSource.getPlaylistName(deezerAnonymousApiRequest, link.playlistId);
  const lines = await deezerSource.getPlaylistTrackLines(deezerAnonymousApiRequest, link.playlistId);

  if (lines.length === 0) {
    throw new Error("That playlist doesn't have any readable tracks.");
  }

  return { name, lines };
}
