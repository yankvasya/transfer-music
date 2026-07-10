import { describe, expect, it } from 'vitest';
import { parseTracklist } from './parser';

describe('parseTracklist', () => {
  it('returns an empty array for empty input', () => {
    expect(parseTracklist('')).toEqual([]);
  });

  it('splits multiple lines and trims blank ones', () => {
    const result = parseTracklist('Artist A - Song A\n\nArtist B - Song B\n');
    expect(result).toHaveLength(2);
  });

  it('parses the standard "Artist - Title" format', () => {
    const [track] = parseTracklist('The Beatles - Let It Be');
    expect(track).toEqual({ raw: 'The Beatles - Let It Be', artist: 'The Beatles', title: 'Let It Be', isValid: true });
  });

  it('supports en-dash and em-dash delimiters', () => {
    const [enDash] = parseTracklist('Artist – Title');
    const [emDash] = parseTracklist('Artist — Title');
    expect(enDash).toMatchObject({ artist: 'Artist', title: 'Title', isValid: true });
    expect(emDash).toMatchObject({ artist: 'Artist', title: 'Title', isValid: true });
  });

  it('supports colon and vertical bar delimiters', () => {
    const [colon] = parseTracklist('Artist : Title');
    const [bar] = parseTracklist('Artist | Title');
    expect(colon).toMatchObject({ artist: 'Artist', title: 'Title', isValid: true });
    expect(bar).toMatchObject({ artist: 'Artist', title: 'Title', isValid: true });
  });

  it('keeps only the title before the first delimiter when the title itself contains a hyphen', () => {
    // The split is greedy on the remainder, so everything after the FIRST delimiter is the title.
    const [track] = parseTracklist('Artist - Song - Remastered');
    expect(track).toMatchObject({ artist: 'Artist', title: 'Song - Remastered', isValid: true });
  });

  it('falls back to treating the whole line as the title when no delimiter is found', () => {
    const [track] = parseTracklist('Just A Title With No Delimiter');
    expect(track).toEqual({
      raw: 'Just A Title With No Delimiter',
      artist: '',
      title: 'Just A Title With No Delimiter',
      isValid: true,
    });
  });

  it('marks a line invalid when the delimiter has nothing on one side', () => {
    const [emptyArtist] = parseTracklist('- Title Only');
    const [emptyTitle] = parseTracklist('Artist Only -');
    expect(emptyArtist.isValid).toBe(false);
    expect(emptyTitle.isValid).toBe(false);
  });

  it('handles Windows-style CRLF line endings', () => {
    const result = parseTracklist('Artist A - Song A\r\nArtist B - Song B\r\n');
    expect(result).toHaveLength(2);
    expect(result[0].artist).toBe('Artist A');
    expect(result[1].artist).toBe('Artist B');
  });
});
