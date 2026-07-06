import type { ParsedTrack } from './utils/parser';

export interface MatchResult {
  track: ParsedTrack;
  spotifyName?: string;
  spotifyArtist?: string;
  uri?: string;
  url?: string;
  success: boolean;
  errorReason?: string;
}

export interface ResumeData {
  playlistId: string;
  playlistUrl: string;
  playlistDesc: string;
  isPublic: boolean;
  tracks: ParsedTrack[];
  startIndex: number;
  matchedTracks: MatchResult[];
  failedTracks: MatchResult[];
  pendingUris: string[];
}
