import type { ParsedTrack } from './utils/parser';

export type ServiceId = 'spotify' | 'youtube' | 'yandex-music' | 'deezer';

export interface MatchResult {
  track: ParsedTrack;
  matchedName?: string;
  matchedArtist?: string;
  externalId?: string;
  url?: string;
  success: boolean;
  errorReason?: string;
  // Set when this line resolved to a track another line in the same import already
  // matched — it's skipped rather than added a second time.
  isDuplicate?: boolean;
}

export interface ResumeData {
  service: ServiceId;
  playlistId: string;
  playlistUrl: string;
  playlistDesc: string;
  isPublic: boolean;
  tracks: ParsedTrack[];
  startIndex: number;
  matchedTracks: MatchResult[];
  failedTracks: MatchResult[];
  // Optional for backward compatibility with resumable entries saved before duplicate
  // detection existed.
  duplicateTracks?: MatchResult[];
  pendingUris: string[];
}
