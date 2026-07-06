import React from 'react';
import type { HistoryEntry } from '../hooks/useHistory';

interface HistoryViewProps {
  history: HistoryEntry[];
  onBack: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ history, onBack }) => {
  return (
    <div className="history-panel glass-panel">
      <h2>🕘 Import History</h2>
      <p className="description-text">
        Playlists you've created with TransferMusic on this device.
      </p>

      {history.length === 0 ? (
        <div className="empty-log">No imports yet.</div>
      ) : (
        <div className="log-list history-list">
          {history.map((entry) => (
            <div key={entry.id} className="log-item history-item">
              <div>
                <div className="log-item-raw">{entry.name}</div>
                <div className="log-item-error" style={{ color: 'var(--text-secondary)' }}>
                  {new Date(entry.createdAt).toLocaleString()} · {entry.matched} matched
                  {entry.failed > 0 ? `, ${entry.failed} not found` : ''}
                </div>
              </div>
              <a href={entry.url} target="_blank" rel="noopener noreferrer" className="log-item-spotify">
                Open in Spotify
              </a>
            </div>
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
};
