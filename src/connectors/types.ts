import type { ParsedTrack } from '../utils/parser';
import type { ServiceId, TrackCandidate } from '../types';

export type ApiRequest = (endpoint: string, options?: RequestInit) => Promise<any>;

export type SearchOutcome =
  | { status: 'found'; externalId: string; matchedTitle: string; matchedArtist: string; url: string; confidence: number }
  // One or more candidates scored above MIN_REVIEW_THRESHOLD but below AUTO_ACCEPT_THRESHOLD —
  // sorted best-first, left for the user to pick from instead of guessing.
  | { status: 'needs_review'; candidates: TrackCandidate[] }
  | { status: 'not_found' }
  | { status: 'rate_limited'; waitSeconds: number }
  | { status: 'quota_exceeded' };

export type AddTracksOutcome =
  | { status: 'ok' }
  | { status: 'rate_limited'; waitSeconds: number }
  | { status: 'quota_exceeded' };

// A destination music service the app can create a playlist in. Search and add are kept
// separate (rather than one big "import track" call) because ImporterProgress batches adds
// independently of searches — batchSize tells it how many matches to accumulate first
// (Spotify accepts up to 100 per call; YouTube's API only ever takes one).
export interface DestinationConnector {
  id: ServiceId;
  label: string;
  batchSize: number;
  createPlaylist(
    apiRequest: ApiRequest,
    name: string,
    description: string,
    isPublic: boolean
  ): Promise<{ id: string; url: string }>;
  searchTrack(apiRequest: ApiRequest, track: ParsedTrack): Promise<SearchOutcome>;
  addTracks(apiRequest: ApiRequest, playlistId: string, externalIds: string[]): Promise<AddTracksOutcome>;
}

export interface PlaylistSummary {
  id: string;
  name: string;
  trackCount: number;
  externalUrl: string;
  // Whether this app can actually read the playlist's tracks — e.g. Spotify only allows
  // reading playlists you own or collaborate on; YouTube's "mine" listing has no such gap.
  exportable: boolean;
  unexportableReason?: string;
}

// A music service the app can read an existing playlist out of, for the export direction.
export interface SourceConnector {
  id: ServiceId;
  label: string;
  listPlaylists(apiRequest: ApiRequest, currentUserId: string | null): Promise<PlaylistSummary[]>;
  getPlaylistName(apiRequest: ApiRequest, playlistId: string): Promise<string>;
  // Returns "Artist - Title" lines, already filtering out removed/local/unavailable tracks.
  getPlaylistTrackLines(apiRequest: ApiRequest, playlistId: string): Promise<string[]>;
}
