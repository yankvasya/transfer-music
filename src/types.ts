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
  pendingUris: string[];
}
