import React, { useState, useEffect, useRef } from 'react';
import { parseTracklist } from '../utils/parser';
import type { ParsedTrack } from '../utils/parser';
import { detectPlaylistLink } from '../utils/playlistLink';
import { fetchPlaylistFromLink } from '../utils/anonymousImport';

interface TrackInputProps {
  initialText: string;
  onNext: (tracks: ParsedTrack[], rawText: string) => void;
}

export const TrackInput: React.FC<TrackInputProps> = ({ initialText, onNext }) => {
  const [text, setText] = useState(initialText);
  const [parsed, setParsed] = useState<ParsedTrack[]>([]);
  const [linkStatus, setLinkStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [linkError, setLinkError] = useState('');
  const [importedFrom, setImportedFrom] = useState('');
  // Guards against a stale fetch (from a since-edited link) overwriting newer input.
  const fetchTokenRef = useRef(0);

  useEffect(() => {
    setParsed(parseTracklist(text));
  }, [text]);

  const handleChange = (value: string) => {
    setText(value);
    setImportedFrom('');
    setLinkStatus('idle');
    setLinkError('');

    const link = detectPlaylistLink(value);
    if (!link) return;

    const token = ++fetchTokenRef.current;
    setLinkStatus('loading');
    fetchPlaylistFromLink(link)
      .then(({ name, lines }) => {
        if (fetchTokenRef.current !== token) return; // input changed while this was in flight
        setText(lines.join('\n'));
        setImportedFrom(name);
        setLinkStatus('idle');
      })
      .catch((err) => {
        if (fetchTokenRef.current !== token) return;
        setLinkStatus('error');
        setLinkError(err instanceof Error ? err.message : 'Failed to read that playlist.');
      });
  };

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
        Paste a list of songs, one per line, or paste a public Deezer playlist link to pull its tracks in
        automatically. For best results with manual entry, use the <code>Artist - Track Title</code> format.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <textarea
            className="form-control track-textarea"
            rows={12}
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={"Artist 1 - Track Title 1\nArtist 2 - Track Title 2\nSome Other Song Name\n\n...or paste a public Deezer playlist link"}
            disabled={linkStatus === 'loading'}
          />
        </div>

        {linkStatus === 'loading' && (
          <div className="parse-stats">
            <span className="badge badge-warning">Reading tracks from that link…</span>
          </div>
        )}

        {linkStatus === 'error' && (
          <div className="parse-stats">
            <span className="badge badge-danger">{linkError}</span>
          </div>
        )}

        {importedFrom && (
          <div className="parse-stats">
            <span className="badge badge-success">Imported from "{importedFrom}"</span>
          </div>
        )}

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
