import { describe, expect, it } from 'vitest';
import { scoreMatch, selectMatch, AUTO_ACCEPT_THRESHOLD, MIN_REVIEW_THRESHOLD } from './matching';

describe('scoreMatch', () => {
  it('scores an exact match as 1', () => {
    const score = scoreMatch({ artist: 'The Beatles', title: 'Let It Be' }, { artist: 'The Beatles', title: 'Let It Be' });
    expect(score).toBe(1);
  });

  it('is case-insensitive', () => {
    const score = scoreMatch({ artist: 'the beatles', title: 'let it be' }, { artist: 'THE BEATLES', title: 'LET IT BE' });
    expect(score).toBe(1);
  });

  it('ignores parenthetical/bracketed suffixes on both sides (remaster tags, live tags, etc.)', () => {
    const score = scoreMatch(
      { artist: 'Artist', title: 'Song Title (Live)' },
      { artist: 'Artist', title: 'Song Title (2011 Remaster)' }
    );
    expect(score).toBe(1);
  });

  it('scores minor artist-name formatting differences high but not perfect', () => {
    const score = scoreMatch({ artist: 'Beatles', title: 'Let It Be' }, { artist: 'The Beatles', title: 'Let It Be' });
    expect(score).toBeGreaterThan(AUTO_ACCEPT_THRESHOLD);
    expect(score).toBeLessThan(1);
  });

  it('does not penalize the artist half when the query has no parsed artist', () => {
    const score = scoreMatch({ artist: '', title: 'Let It Be' }, { artist: 'Some Completely Different Artist', title: 'Let It Be' });
    expect(score).toBe(1);
  });

  it('scores a genuinely different song low', () => {
    const score = scoreMatch({ artist: 'Artist X', title: 'Song Y' }, { artist: 'Artist Z', title: 'Completely Unrelated Title' });
    expect(score).toBeLessThan(MIN_REVIEW_THRESHOLD);
  });

  it('scores a same-title-different-artist cover in the review range, not auto-accepted', () => {
    const score = scoreMatch({ artist: 'Original Artist', title: 'Some Song' }, { artist: 'Cover Band', title: 'Some Song' });
    expect(score).toBeGreaterThanOrEqual(MIN_REVIEW_THRESHOLD);
    expect(score).toBeLessThan(AUTO_ACCEPT_THRESHOLD);
  });

  it('auto-accepts when the query names just the primary artist and the candidate credits featured artists too', () => {
    const score = scoreMatch(
      { artist: 'Linkin Park', title: 'Good Goodbye (feat. Pusha T & Stormzy)' },
      { artist: 'Linkin Park, Pusha T, Stormzy', title: 'Good Goodbye (feat. Pusha T and Stormzy)' }
    );
    expect(score).toBeGreaterThanOrEqual(AUTO_ACCEPT_THRESHOLD);
  });

  it('still scores a genuinely different artist low even against a multi-artist credit list', () => {
    const score = scoreMatch(
      { artist: 'Some Other Artist', title: 'Good Goodbye' },
      { artist: 'Linkin Park, Pusha T, Stormzy', title: 'Good Goodbye' }
    );
    expect(score).toBeLessThan(AUTO_ACCEPT_THRESHOLD);
  });
});

describe('selectMatch', () => {
  const query = { artist: 'The Beatles', title: 'Let It Be' };

  it('auto-accepts a high-confidence top candidate', () => {
    const result = selectMatch(query, [
      { externalId: 'id1', title: 'Let It Be', artist: 'The Beatles', url: 'https://example.com/1' },
    ]);
    expect(result).toMatchObject({ status: 'found', externalId: 'id1' });
  });

  it('returns not_found when there are no candidates at all', () => {
    expect(selectMatch(query, [])).toEqual({ status: 'not_found' });
  });

  it('returns not_found when every candidate scores below the review floor', () => {
    const result = selectMatch(query, [
      { externalId: 'id1', title: 'Completely Different Song', artist: 'Someone Else', url: 'x' },
    ]);
    expect(result).toEqual({ status: 'not_found' });
  });

  it('returns needs_review with sorted candidates when the top score is between the thresholds', () => {
    const result = selectMatch(query, [
      { externalId: 'low', title: 'Let It', artist: 'A Beatles Cover Band', url: 'x' },
      { externalId: 'high', title: 'Let It Be', artist: 'A Beatles Cover Band', url: 'y' },
    ]);
    expect(result.status).toBe('needs_review');
    if (result.status === 'needs_review') {
      expect(result.candidates[0].externalId).toBe('high');
      expect(result.candidates.every((c) => c.confidence < AUTO_ACCEPT_THRESHOLD)).toBe(true);
    }
  });

  it('caps needs_review candidates at 5, dropping the lowest-scoring ones', () => {
    const candidates = Array.from({ length: 8 }, (_, i) => ({
      externalId: `id${i}`,
      title: `Let It B${'e'.repeat(1 + i)}`, // progressively worse matches
      artist: 'A Beatles Cover Band',
      url: 'x',
    }));
    const result = selectMatch(query, candidates);
    expect(result.status).toBe('needs_review');
    if (result.status === 'needs_review') {
      expect(result.candidates.length).toBeLessThanOrEqual(5);
    }
  });
});
