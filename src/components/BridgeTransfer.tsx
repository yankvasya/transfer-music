import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ApiRequest, PlaylistSummary, SourceConnector } from '../connectors/types';
import { SERVICE_META } from '../serviceMeta';
import type { ServiceId } from '../types';

interface BridgeTransferProps {
  from: ServiceId;
  to: ServiceId;
  source: SourceConnector;
  sourceApiRequest: ApiRequest;
  sourceCurrentUserId: string | null;
}

// Lets the user pick one or more source playlists to move straight into the destination
// service. Selecting a single playlist is just a queue of length one — BridgeQueue (the
// next step) handles both the same way, so there's only one code path to maintain.
export const BridgeTransfer: React.FC<BridgeTransferProps> = ({ from, to, source, sourceApiRequest, sourceCurrentUserId }) => {
  const navigate = useNavigate();
  const toMeta = SERVICE_META[to];

  const [step, setStep] = useState<'loading' | 'select' | 'error'>('loading');
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    setStep('loading');

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
  }, [source, sourceApiRequest, sourceCurrentUserId]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleContinue = () => {
    if (selected.size === 0) return;
    navigate(`/bridge-queue?from=${from}&to=${to}&playlist_ids=${Array.from(selected).join(',')}`);
  };

  if (step === 'loading') {
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

  return (
    <div className="glass-panel">
      <h2>
        🔀 Move {source.label} Playlists to {toMeta.name}
      </h2>
      <p className="description-text">
        Pick one or more {source.label} playlists to transfer directly into {toMeta.name}.
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
                  className={`playlist-pick-button${selected.has(playlist.id) ? ' selected' : ''}`}
                  onClick={() => toggle(playlist.id)}
                >
                  <input type="checkbox" checked={selected.has(playlist.id)} readOnly tabIndex={-1} />
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
        <button className="btn btn-primary" onClick={handleContinue} disabled={selected.size === 0}>
          Move {selected.size > 0 ? `${selected.size} Playlist${selected.size === 1 ? '' : 's'}` : 'Playlists'} →
        </button>
      </div>
    </div>
  );
};
