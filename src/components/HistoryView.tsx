import React from 'react';
import type { HistoryEntry } from '../hooks/useHistory';
import { SERVICE_META } from '../serviceMeta';

interface HistoryViewProps {
  history: HistoryEntry[];
  onBack: () => void;
  onResume: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ history, onBack, onResume, onDelete }) => {
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
          {history.map((entry) => {
            const meta = SERVICE_META[entry.service];
            return (
              <div key={entry.id} className="log-item history-item">
                <div className="history-item-info">
                  <div className="log-item-raw">
                    <span className="history-service-icon" title={meta.name}>
                      {meta.icon}
                    </span>{' '}
                    {entry.name}
                    {entry.status === 'incomplete' && (
                      <span className="badge badge-warning">Incomplete</span>
                    )}
                  </div>
                  <div className="log-item-error" style={{ color: 'var(--text-secondary)' }}>
                    {new Date(entry.createdAt).toLocaleString()} · {entry.matched}/{entry.total} matched
                    {entry.needsReview ? `, ${entry.needsReview} need${entry.needsReview === 1 ? 's' : ''} review` : ''}
                    {entry.failed > 0 ? `, ${entry.failed} not found` : ''}
                    {entry.duplicates ? `, ${entry.duplicates} duplicate${entry.duplicates === 1 ? '' : 's'} skipped` : ''}
                  </div>
                </div>
                <div className="history-item-actions">
                  {entry.status === 'incomplete' ? (
                    <button className="btn btn-sm btn-outline-success" onClick={() => onResume(entry)}>
                      ▶ Resume
                    </button>
                  ) : (
                    <a href={entry.url} target="_blank" rel="noopener noreferrer" className="log-item-spotify">
                      Open in {meta.name}
                    </a>
                  )}
                  <button className="btn btn-sm btn-outline-danger" onClick={() => onDelete(entry.id)}>
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
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
