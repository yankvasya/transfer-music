import type { ParsedTrack } from './utils/parser';

export type ServiceId = 'spotify' | 'youtube' | 'yandex-music' | 'deezer';

// Defined here (not in connectors/types.ts) since ResumeData below also needs it, and
// connectors/types.ts already imports ServiceId from this file — keeping it here avoids
// a circular import between the two.
export interface TrackCandidate {
  externalId: string;
  title: string;
  artist: string;
  url: string;
  confidence: number; // 0-1, from utils/matching's scoreMatch
}

export interface ReviewTrack {
  track: ParsedTrack;
  candidates: TrackCandidate[];
}

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

// Shared by ImporterProgress/BridgeQueue/BridgeQueueRoute's onSaveProgress/onImportComplete
// callbacks and HistoryEntry, rather than repeating this object type at every call site.
export interface ImportSummary {
  service: ServiceId;
  name: string;
  url: string;
  matched: number;
  failed: number;
  duplicates: number;
  needsReview: number;
  total: number;
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
  // detection / smart matching existed.
  duplicateTracks?: MatchResult[];
  reviewTracks?: ReviewTrack[];
  pendingUris: string[];
}
