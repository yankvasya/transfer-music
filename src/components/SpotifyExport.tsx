import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

interface SpotifyPlaylistSummary {
  id: string;
  name: string;
  trackCount: number;
  image?: string;
}

interface SpotifyExportProps {
  apiRequest: (endpoint: string, options?: RequestInit) => Promise<any>;
}

export const SpotifyExport: React.FC<SpotifyExportProps> = ({ apiRequest }) => {
  const { playlistId } = useParams<{ playlistId?: string }>();
  const navigate = useNavigate();

  const [step, setStep] = useState<'loading-playlists' | 'select' | 'loading-tracks' | 'result' | 'error'>(
    playlistId ? 'loading-tracks' : 'loading-playlists'
  );
  const [playlists, setPlaylists] = useState<SpotifyPlaylistSummary[]>([]);
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
        const results: SpotifyPlaylistSummary[] = [];
        let endpoint: string | null = '/me/playlists?limit=50';

        while (endpoint) {
          const data = await apiRequest(endpoint);
          for (const p of data.items || []) {
            results.push({
              id: p.id,
              name: p.name,
              // "items" is the current field name; "tracks" is Spotify's deprecated alias for it.
              trackCount: p.items?.total ?? p.tracks?.total ?? 0,
              image: p.images?.[0]?.url,
            });
          }
          endpoint = data.next;
        }

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
  }, [apiRequest, playlistId]);

  // Loads a specific playlist's tracks — driven entirely by the URL, so a direct link or a
  // reload while viewing a playlist re-fetches the same one instead of losing everything.
  useEffect(() => {
    if (!playlistId) return;
    let active = true;
    setStep('loading-tracks');

    const loadTracks = async () => {
      try {
        const meta = await apiRequest(`/playlists/${playlistId}?fields=name`);
        if (!active) return;
        setSelectedName(meta.name);

        const lines: string[] = [];
        let endpoint: string | null = `/playlists/${playlistId}/items?limit=100`;

        while (endpoint) {
          const data = await apiRequest(endpoint);
          for (const entry of data.items || []) {
            // "item" is the current field name; "track" is Spotify's deprecated alias for it.
            const track = entry.item ?? entry.track;
            if (!track) continue; // removed/local tracks come back null
            const artists = (track.artists || []).map((a: any) => a.name).join(', ');
            lines.push(artists ? `${artists} - ${track.name}` : track.name);
          }
          endpoint = data.next;
        }

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
  }, [playlistId, apiRequest]);

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

  const handleDownload = () => {
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${selectedName.replace(/\s+/g, '_')}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (step === 'loading-playlists') {
    return (
      <div className="glass-panel center-align">
        <div className="spinner">Loading your Spotify playlists...</div>
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
        <h2>📤 Export a Spotify Playlist</h2>
        <p className="description-text">Pick a playlist to turn into a plain-text tracklist.</p>

        {playlists.length === 0 ? (
          <div className="empty-log">You don't have any playlists yet.</div>
        ) : (
          <div className="log-list history-list">
            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                className="log-item history-item playlist-pick-item"
                onClick={() => navigate(`/export/${playlist.id}`)}
              >
                <div className="history-item-info">
                  <div className="log-item-raw">{playlist.name}</div>
                  <div className="log-item-error" style={{ color: 'var(--text-secondary)' }}>
                    {playlist.trackCount} tracks
                  </div>
                </div>
              </button>
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
      </div>
    </div>
  );
};
