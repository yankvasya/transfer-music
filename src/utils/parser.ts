export interface ParsedTrack {
  raw: string;
  artist: string;
  title: string;
  isValid: boolean;
}

/**
 * Parses a raw text block of tracks (one track per line).
 * Supported formats:
 * - Artist - Title
 * - Artist – Title (en-dash)
 * - Artist — Title (em-dash)
 * - Artist : Title
 * - Title (falls back to searching the whole string)
 */
export function parseTracklist(text: string): ParsedTrack[] {
  if (!text) return [];

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      // Look for common delimiters: hyphen, en-dash, em-dash, colon, vertical bar
      const match = line.split(/\s*[-–—:|]\s*(.*)/s);

      if (match.length >= 2) {
        const artist = match[0].trim();
        const title = match[1].trim();
        return {
          raw: line,
          artist,
          title,
          isValid: artist.length > 0 && title.length > 0,
        };
      }

      // Fallback: whole line is treated as title with empty artist
      return {
        raw: line,
        artist: '',
        title: line,
        isValid: line.length > 0,
      };
    });
}
