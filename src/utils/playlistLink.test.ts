import { describe, expect, it } from 'vitest';
import { detectPlaylistLink } from './playlistLink';

describe('detectPlaylistLink', () => {
  it('detects a bare Deezer playlist URL', () => {
    expect(detectPlaylistLink('https://www.deezer.com/playlist/1234567890')).toEqual({
      service: 'deezer',
      playlistId: '1234567890',
    });
  });

  it('detects a Deezer playlist URL with a locale segment', () => {
    expect(detectPlaylistLink('https://www.deezer.com/en/playlist/1234567890')).toEqual({
      service: 'deezer',
      playlistId: '1234567890',
    });
  });

  it('detects without the www subdomain', () => {
    expect(detectPlaylistLink('https://deezer.com/playlist/42')).toEqual({ service: 'deezer', playlistId: '42' });
  });

  it('ignores surrounding whitespace', () => {
    expect(detectPlaylistLink('  https://www.deezer.com/playlist/42  \n')).toEqual({
      service: 'deezer',
      playlistId: '42',
    });
  });

  it('returns null for a Deezer link that is not a playlist', () => {
    expect(detectPlaylistLink('https://www.deezer.com/artist/42')).toBeNull();
  });

  it('returns null for a Spotify playlist link (not supported anonymously)', () => {
    expect(detectPlaylistLink('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBeNull();
  });

  it('returns null for plain tracklist text', () => {
    expect(detectPlaylistLink('Daft Punk - One More Time')).toBeNull();
  });

  it('returns null for a multi-line paste even if one line is a link', () => {
    expect(detectPlaylistLink('https://www.deezer.com/playlist/42\nDaft Punk - One More Time')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlaylistLink('')).toBeNull();
  });

  it('returns null for invalid URLs', () => {
    expect(detectPlaylistLink('not a url at all')).toBeNull();
  });
});
