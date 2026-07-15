export type LinkPlaylistService = 'deezer';

export interface DetectedPlaylistLink {
  service: LinkPlaylistService;
  playlistId: string;
}

// Recognizes a pasted public Deezer playlist URL (e.g. from "Copy Link" in the Deezer web
// app: https://www.deezer.com/playlist/{id} or https://www.deezer.com/en/playlist/{id}) and
// pulls out its playlist ID, so the caller can fetch the tracklist without the user ever
// logging in. Spotify is deliberately not supported here — as of Spotify's March 2026 Web
// API migration, playlist track items are only ever returned for playlists the
// authenticated identity owns or collaborates on, for every token type including
// app-only/Client Credentials, so there's no anonymous path for it.
export function detectPlaylistLink(input: string): DetectedPlaylistLink | null {
  const trimmed = input.trim();
  if (!trimmed || /\s/.test(trimmed)) return null; // must be a single bare URL, not tracklist text

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '');
  const segments = url.pathname.split('/').filter(Boolean);

  if (host === 'deezer.com') {
    const idx = segments.indexOf('playlist');
    if (idx !== -1 && segments[idx + 1]) {
      return { service: 'deezer', playlistId: segments[idx + 1] };
    }
  }

  return null;
}
