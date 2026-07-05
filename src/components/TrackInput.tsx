import React, { useState, useEffect } from 'react';
import { parseTracklist } from '../utils/parser';
import type { ParsedTrack } from '../utils/parser';

interface TrackInputProps {
  initialText: string;
  onNext: (tracks: ParsedTrack[], rawText: string) => void;
}

export const TrackInput: React.FC<TrackInputProps> = ({ initialText, onNext }) => {
  const [text, setText] = useState(initialText);
  const [parsed, setParsed] = useState<ParsedTrack[]>([]);

  useEffect(() => {
    setParsed(parseTracklist(text));
  }, [text]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsed.length > 0) {
      onNext(parsed, text);
    }
  };

  const validCount = parsed.filter((t) => t.isValid).length;
  const fallbackCount = parsed.length - validCount;

  return (
    <div className="track-input-panel glass-panel">
      <h2>📝 Step 1: Enter your tracklist</h2>
      <p className="description-text">
        Paste a list of songs, one per line. For best results, use the <code>Artist - Track Title</code> format.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <textarea
            className="form-control track-textarea"
            rows={12}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Artist 1 - Track Title 1&#10;Artist 2 - Track Title 2&#10;Some Other Song Name`}
          />
        </div>

        {parsed.length > 0 && (
          <div className="parse-stats">
            <span className="badge badge-success">{parsed.length} Tracks detected</span>
            {fallbackCount > 0 && (
              <span className="badge badge-warning">
                {fallbackCount} lines will search by entire text (no split)
              </span>
            )}
          </div>
        )}

        <div className="form-actions right-align">
          <button type="submit" className="btn btn-primary btn-lg" disabled={parsed.length === 0}>
            Continue to Playlist Setup →
          </button>
        </div>
      </form>
    </div>
  );
};
