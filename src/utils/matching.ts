// Track ids: no dependency for this since it's a well-contained problem — a lightweight,
// dependency-free normalized-Levenshtein similarity is enough to distinguish "same song,
// different formatting" from "actually a different song".

// Strips parenthetical/bracketed suffixes (remaster years, "(Live)", "(feat. X)", etc.),
// punctuation, and collapses whitespace, so formatting differences between a pasted
// tracklist and a search result don't count against the match.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

// 1.0 = identical after normalization, 0.0 = completely different, scaled by the longer
// of the two normalized strings so short/long mismatches are penalized proportionally.
function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const dist = levenshtein(na, nb);
  return 1 - dist / Math.max(na.length, nb.length);
}

// Splits a comma-separated artist credit list ("Linkin Park, Pusha T, Stormzy") into
// individual names.
function artistSegments(s: string): string[] {
  return s.split(',').map((seg) => seg.trim()).filter(Boolean);
}

// A search result's artist field often credits every featured artist ("Linkin Park,
// Pusha T, Stormzy") while a pasted tracklist line usually names just the primary one
// ("Linkin Park") — comparing the raw strings directly penalizes that length mismatch
// even though it's the correct track. Comparing every segment of one against every
// segment of the other and taking the best pairing finds that match without weakening
// the case a plain single-artist mismatch is actually meant to catch (no commas means
// this is exactly the same as a direct comparison).
function artistSimilarity(a: string, b: string): number {
  let best = 0;
  for (const sa of artistSegments(a)) {
    for (const sb of artistSegments(b)) {
      best = Math.max(best, similarity(sa, sb));
    }
  }
  return best;
}

export interface MatchQuery {
  artist: string;
  title: string;
}

// Strips the same parenthetical/bracketed content scoring already ignores (remix/version
// tags, "(feat. X)", etc.), so a second search attempt can cast a wider net when the
// exact wording — a remix name the destination's catalog doesn't have verbatim — returns
// nothing at all. Returns the original string unchanged if there's nothing to strip, so
// callers can tell "no parentheses, retrying would just repeat the same search" apart
// from "there was something to try without."
export function stripParentheticals(title: string): string {
  return title.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Title carries more weight than artist — artist-name formatting varies a lot in
// practice ("The Beatles" vs "Beatles", featured-artist lists, etc.) and shouldn't sink
// an otherwise-clear title match. A query with no parsed artist doesn't penalize the
// artist half at all, since there's nothing to compare.
export function scoreMatch(query: MatchQuery, candidate: MatchQuery): number {
  const titleScore = similarity(query.title, candidate.title);
  const artistScore = query.artist ? artistSimilarity(query.artist, candidate.artist) : 1;
  return titleScore * 0.65 + artistScore * 0.35;
}

// Above this, a match is accepted automatically without user review.
export const AUTO_ACCEPT_THRESHOLD = 0.85;
// Below this, a candidate isn't worth showing at all (effectively not_found).
export const MIN_REVIEW_THRESHOLD = 0.5;
// Cap on how many candidates a "needs review" outcome carries, so the review UI doesn't
// have to render a long tail of increasingly-unlikely results.
const MAX_REVIEW_CANDIDATES = 5;

export interface RawCandidate {
  externalId: string;
  title: string;
  artist: string;
  url: string;
}

// Shared by every connector's searchTrack: score every candidate the API returned, drop
// anything below the review floor, and either auto-accept the top one, hand back a
// shortlist for the user to pick from, or report nothing usable was found. Centralized
// here (rather than duplicated per connector) so all four services behave identically.
//
// forceReview: set by a connector's fallback search (see stripParentheticals) — a match
// found only by simplifying the query means the exact wording asked for isn't in the
// destination's catalog, so even a high-confidence candidate might be a *different*
// version of the track than the one requested. Surfacing it for a human to confirm
// rather than silently substituting it in is the safe direction for that uncertainty.
export function selectMatch(query: MatchQuery, candidates: RawCandidate[], options: { forceReview?: boolean } = {}) {
  const scored = candidates
    .map((c) => ({ ...c, confidence: scoreMatch(query, c) }))
    .filter((c) => c.confidence >= MIN_REVIEW_THRESHOLD)
    .sort((a, b) => b.confidence - a.confidence);

  if (scored.length === 0) {
    return { status: 'not_found' as const };
  }

  if (!options.forceReview && scored[0].confidence >= AUTO_ACCEPT_THRESHOLD) {
    const top = scored[0];
    return {
      status: 'found' as const,
      externalId: top.externalId,
      matchedTitle: top.title,
      matchedArtist: top.artist,
      url: top.url,
      confidence: top.confidence,
    };
  }

  return { status: 'needs_review' as const, candidates: scored.slice(0, MAX_REVIEW_CANDIDATES) };
}
