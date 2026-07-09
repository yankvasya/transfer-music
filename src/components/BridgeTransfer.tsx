import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ApiRequest, PlaylistSummary, SourceConnector } from '../connectors/types';
import { parseTracklist } from '../utils/parser';
import type { ParsedTrack } from '../utils/parser';
import { SERVICE_META } from '../serviceMeta';
import type { ServiceId } from '../types';

interface BridgeTransferProps {
  from: ServiceId;
  to: ServiceId;
  source: SourceConnector;
  sourceApiRequest: ApiRequest;
  sourceCurrentUserId: string | null;
  playlistId: string | null;
  onTracksReady: (tracks: ParsedTrack[], rawText: string) => void;
}

// Picks a source playlist and hands its parsed tracks straight to the destination's
// playlist-setup step (via onTracksReady, which is App.tsx's existing handleTracksNext) —
// same downstream pipeline (PlaylistSetup, ImporterProgress, History/resume) as a manual
// paste import, just fed from a real playlist instead of typed text. Mirrors ExportView's
// list-and-select step, but ends by parsing instead of showing text to copy.
export const BridgeTransfer: React.FC<BridgeTransferProps> = ({
  from,
  to,
  source,
  sourceApiRequest,
  sourceCurrentUserId,
  playlistId,
  onTracksReady,
}) => {
  const navigate = useNavigate();
  const toMeta = SERVICE_META[to];

  const [step, setStep] = useState<'loading-playlists' | 'select' | 'loading-tracks' | 'error'>(
    playlistId ? 'loading-tracks' : 'loading-playlists'
  );
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (playlistId) return;
    let active = true;
    setStep('loading-playlists');

    source
      .listPlaylists(sourceApiRequest, sourceCurrentUserId)
      .then((results) => {
        if (active) {
          setPlaylists(results);
          setStep('select');
        }
      })
      .catch((err: any) => {
        if (active) {
          setErrorMsg(err.message || 'Failed to load your playlists.');
          setStep('error');
        }
      });

    return () => {
      active = false;
    };
  }, [playlistId, source, sourceApiRequest, sourceCurrentUserId]);

  useEffect(() => {
    if (!playlistId) return;
    let active = true;
    setStep('loading-tracks');

    source
      .getPlaylistTrackLines(sourceApiRequest, playlistId)
      .then((lines) => {
        if (!active) return;
        const text = lines.join('\n');
        onTracksReady(parseTracklist(text), text);
      })
      .catch((err: any) => {
        if (active) {
          setErrorMsg(err.message || "Failed to load this playlist's tracks.");
          setStep('error');
        }
      });

    return () => {
      active = false;
    };
  }, [playlistId, source, sourceApiRequest, onTracksReady]);

  if (step === 'loading-playlists') {
    return (
      <div className="glass-panel center-align">
        <div className="spinner">Loading your {source.label} playlists...</div>
      </div>
    );
  }

  if (step === 'loading-tracks') {
    return (
      <div className="glass-panel center-align">
        <div className="spinner">Fetching tracks to move to {toMeta.name}...</div>
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

  return (
    <div className="glass-panel">
      <h2>
        🔀 Move a {source.label} Playlist to {toMeta.name}
      </h2>
      <p className="description-text">
        Pick a {source.label} playlist to transfer directly into {toMeta.name}.
      </p>

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
                  onClick={() => navigate(`/bridge?from=${from}&to=${to}&playlist_id=${playlist.id}`)}
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
};
