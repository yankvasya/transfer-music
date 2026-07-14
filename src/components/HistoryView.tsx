import React, { useRef } from 'react';
import type { HistoryEntry } from '../hooks/useHistory';
import { SERVICE_META } from '../serviceMeta';
import { ServiceIcon } from './ServiceIcon';

interface HistoryViewProps {
  history: HistoryEntry[];
  onBack: () => void;
  onResume: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
  // Returns how many entries were actually restored, so the caller can report back —
  // see the note on useHistory's restoreHistory for why this exists at all: everything
  // here is localStorage-only, so this is the only way history survives clearing site
  // data or moving to a different browser.
  onImportHistory: (entries: unknown[]) => number;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ history, onBack, onResume, onDelete, onImportHistory }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `transfermusic-history-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file next time
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error('not an array');
      const count = onImportHistory(parsed);
      alert(count > 0 ? `Restored ${count} history entr${count === 1 ? 'y' : 'ies'}.` : 'No valid history entries found in that file.');
    } catch {
      alert("Couldn't read that file — it doesn't look like a TransferMusic history export.");
    }
  };

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
                      <ServiceIcon service={entry.service} size={16} />
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
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => {
                      if (confirm(`Remove "${entry.name}" from your import history? This won't affect the playlist itself.`)) {
                        onDelete(entry.id);
                      }
                    }}
                  >
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
        {history.length > 0 && (
          <button className="btn btn-outline" onClick={handleExport}>
            ⬇ Export History
          </button>
        )}
        <button className="btn btn-outline" onClick={() => fileInputRef.current?.click()}>
          ⬆ Import History
        </button>
        <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleImportFile} style={{ display: 'none' }} />
      </div>
    </div>
  );
};
