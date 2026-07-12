import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ApiRequest, PlaylistSummary, SourceConnector } from '../connectors/types';
import { parseTracklist } from '../utils/parser';

interface ExportViewProps {
  source: SourceConnector;
  apiRequest: ApiRequest;
  currentUserId: string | null;
}

export const ExportView: React.FC<ExportViewProps> = ({ source, apiRequest, currentUserId }) => {
  const [searchParams] = useSearchParams();
  const playlistId = searchParams.get('type') === source.id ? searchParams.get('playlist_id') : null;
  const navigate = useNavigate();

  const [step, setStep] = useState<'loading-playlists' | 'select' | 'loading-tracks' | 'result' | 'error'>(
    playlistId ? 'loading-tracks' : 'loading-playlists'
  );
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [selectedName, setSelectedName] = useState('');
  const [trackLines, setTrackLines] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'selected'>('idle');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Loads the picker list — only relevant when no playlist is selected in the URL.
  useEffect(() => {
    if (playlistId) return;
    let active = true;
    setStep('loading-playlists');

    const loadPlaylists = async () => {
      try {
        const results = await source.listPlaylists(apiRequest, currentUserId);
        if (active) {
          setPlaylists(results);
          setStep('select');
        }
      } catch (err: any) {
        if (active) {
          setErrorMsg(err.message || 'Failed to load your playlists.');
          setStep('error');
        }
      }
    };

    loadPlaylists();
    return () => {
      active = false;
    };
  }, [apiRequest, playlistId, currentUserId, source]);

  // Loads a specific playlist's tracks — driven entirely by the URL, so a direct link or a
  // reload while viewing a playlist re-fetches the same one instead of losing everything.
  useEffect(() => {
    if (!playlistId) return;
    let active = true;
    setStep('loading-tracks');

    const loadTracks = async () => {
      try {
        const name = await source.getPlaylistName(apiRequest, playlistId);
        if (!active) return;
        setSelectedName(name);

        const lines = await source.getPlaylistTrackLines(apiRequest, playlistId);
        if (!active) return;
        setTrackLines(lines);
        setStep('result');
      } catch (err: any) {
        if (active) {
          setErrorMsg(err.message || "Failed to load this playlist's tracks.");
          setStep('error');
        }
      }
    };

    loadTracks();
    return () => {
      active = false;
    };
  }, [playlistId, apiRequest, source]);

  const textContent = trackLines.join('\n');

  const handleCopy = async () => {
    try {
      // Some browsers leave a permission prompt hanging indefinitely instead of
      // rejecting, so race it against a timeout rather than awaiting it forever.
      await Promise.race([
        navigator.clipboard.writeText(textContent),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500)),
      ]);
      setCopyStatus('copied');
    } catch {
      // Clipboard API can be blocked (permissions, insecure context, older Safari) —
      // fall back to selecting the text so the user can copy it manually (Cmd/Ctrl+C).
      textareaRef.current?.select();
      setCopyStatus('selected');
    }
    setTimeout(() => setCopyStatus('idle'), 2500);
  };

  const downloadBlob = (content: string, mimeType: string, extension: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${selectedName.replace(/\s+/g, '_')}.${extension}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownload = () => downloadBlob(textContent, 'text/plain;charset=utf-8', 'txt');

  const handleDownloadCsv = () => {
    // Reuses the same "Artist - Title" split already used on the import side, since every
    // connector writes lines in that exact format — no separate parsing logic needed.
    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = parseTracklist(textContent).map((t) => `${escapeCsv(t.artist)},${escapeCsv(t.title)}`);
    const csv = ['Artist,Title', ...rows].join('\r\n');
    downloadBlob(csv, 'text/csv;charset=utf-8', 'csv');
  };

  if (step === 'loading-playlists') {
    return (
      <div className="glass-panel center-align">
        <div className="spinner">Loading your {source.label} playlists...</div>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="glass-panel">
        <h2>❌ Something went wrong</h2>
        <p className="description-text">{errorMsg}</p>
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={() => navigate('/')}>
            ← Back
          </button>
        </div>
      </div>
    );
  }

  if (step === 'select') {
    return (
      <div className="glass-panel">
        <h2>📤 Export a {source.label} Playlist</h2>
        <p className="description-text">Pick a playlist to turn into a plain-text tracklist.</p>

        {playlists.length === 0 ? (
          <div className="empty-log">You don't have any playlists yet.</div>
        ) : (
          <div className="log-list history-list">
            {playlists.map((playlist) => (
              <div key={playlist.id} className="log-item history-item playlist-pick-item">
                {playlist.exportable ? (
                  <button
                    type="button"
                    className="playlist-pick-button"
                    onClick={() => navigate(`/export?type=${source.id}&playlist_id=${playlist.id}`)}
                  >
                    <div className="history-item-info">
                      <div className="log-item-raw">{playlist.name}</div>
                      <div className="log-item-error" style={{ color: 'var(--text-secondary)' }}>
                        {playlist.trackCount} tracks
                      </div>
                    </div>
                  </button>
                ) : (
                  <>
                    <div className="history-item-info playlist-pick-disabled">
                      <div className="log-item-raw">{playlist.name}</div>
                      <div className="log-item-error" style={{ color: 'var(--text-secondary)' }}>
                        {playlist.trackCount} tracks
                      </div>
                    </div>
                    <span className="playlist-not-owned-badge" title={playlist.unexportableReason}>
                      ❓
                    </span>
                    <a href={playlist.externalUrl} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline">
                      Open in {source.label}
                    </a>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="form-actions center-align mt-4">
          <button className="btn btn-secondary" onClick={() => navigate('/')}>
            ← Back
          </button>
        </div>
      </div>
    );
  }

  if (step === 'loading-tracks') {
    return (
      <div className="glass-panel center-align">
        <div className="spinner">Fetching tracks{selectedName ? ` from "${selectedName}"` : ''}...</div>
      </div>
    );
  }

  return (
    <div className="glass-panel">
      <h2>📤 "{selectedName}"</h2>
      <p className="description-text">{trackLines.length} tracks, ready to copy or download.</p>

      <div className="form-group">
        <textarea ref={textareaRef} className="form-control track-textarea" rows={12} value={textContent} readOnly />
      </div>

      <div className="form-actions">
        <button className="btn btn-secondary" onClick={() => navigate('/export')}>
          ← Choose Another Playlist
        </button>
        <button className="btn btn-outline" onClick={handleCopy}>
          {copyStatus === 'copied' ? '✓ Copied!' : copyStatus === 'selected' ? 'Selected — press Cmd/Ctrl+C' : '📋 Copy to Clipboard'}
        </button>
        <button className="btn btn-success" onClick={handleDownload}>
          ⬇ Download .txt
        </button>
        <button className="btn btn-success" onClick={handleDownloadCsv}>
          ⬇ Download .csv
        </button>
      </div>
    </div>
  );
};
