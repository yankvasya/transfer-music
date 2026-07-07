import React, { useEffect, useRef, useState } from 'react';

interface SpotifyPlaylistSummary {
  id: string;
  name: string;
  trackCount: number;
  image?: string;
}

interface SpotifyExportProps {
  apiRequest: (endpoint: string, options?: RequestInit) => Promise<any>;
  onBack: () => void;
}

export const SpotifyExport: React.FC<SpotifyExportProps> = ({ apiRequest, onBack }) => {
  const [step, setStep] = useState<'loading-playlists' | 'select' | 'loading-tracks' | 'result' | 'error'>(
    'loading-playlists'
  );
  const [playlists, setPlaylists] = useState<SpotifyPlaylistSummary[]>([]);
  const [selectedName, setSelectedName] = useState('');
  const [trackLines, setTrackLines] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'selected'>('idle');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let active = true;

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
              trackCount: p.tracks?.total ?? 0,
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
  }, [apiRequest]);

  const handleSelectPlaylist = async (playlist: SpotifyPlaylistSummary) => {
    setSelectedName(playlist.name);
    setStep('loading-tracks');

    try {
      const lines: string[] = [];
      let endpoint: string | null = `/playlists/${playlist.id}/items?limit=100`;

      while (endpoint) {
        const data = await apiRequest(endpoint);
        for (const item of data.items || []) {
          const track = item.track;
          if (!track) continue; // removed/local tracks come back null
          const artists = (track.artists || []).map((a: any) => a.name).join(', ');
          lines.push(artists ? `${artists} - ${track.name}` : track.name);
        }
        endpoint = data.next;
      }

      setTrackLines(lines);
      setStep('result');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load this playlist\'s tracks.');
      setStep('error');
    }
  };

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
          <button className="btn btn-secondary" onClick={onBack}>
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
                onClick={() => handleSelectPlaylist(playlist)}
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
          <button className="btn btn-secondary" onClick={onBack}>
            ← Back
          </button>
        </div>
      </div>
    );
  }

  if (step === 'loading-tracks') {
    return (
      <div className="glass-panel center-align">
        <div className="spinner">Fetching tracks from "{selectedName}"...</div>
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
        <button className="btn btn-secondary" onClick={() => setStep('select')}>
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
