import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImporterProgress } from './ImporterProgress';
import { SERVICE_META } from '../serviceMeta';
import { parseTracklist } from '../utils/parser';
import type { ParsedTrack } from '../utils/parser';
import type { ApiRequest, DestinationConnector, SourceConnector } from '../connectors/types';
import type { ImportSummary, ResumeData, ServiceId } from '../types';

interface BridgeQueueProps {
  to: ServiceId;
  playlistIds: string[];
  source: SourceConnector;
  destination: DestinationConnector;
  sourceApiRequest: ApiRequest;
  destApiRequest: ApiRequest;
  onSaveProgress: (id: string, summary: ImportSummary, resumeData: ResumeData) => void;
  onImportComplete: (id: string, summary: ImportSummary) => void;
}

// Drives one or more source playlists through the existing single-playlist import
// pipeline (ImporterProgress) sequentially, rather than building a separate bulk-import
// loop. Each queued item is rendered as a BridgeQueueItem keyed by `index` — a genuine
// React remount per item, so its name/tracks/historyId can never end up mismatched with
// each other (unlike deriving them as separate state updates in one long-lived
// component, where a prop can update before an async-fetched value catches up).
export const BridgeQueue: React.FC<BridgeQueueProps> = ({
  to,
  playlistIds,
  source,
  destination,
  sourceApiRequest,
  destApiRequest,
  onSaveProgress,
  onImportComplete,
}) => {
  const navigate = useNavigate();
  const toMeta = SERVICE_META[to];

  const [index, setIndex] = useState(0);
  const [completed, setCompleted] = useState<{ name: string; url: string }[]>([]);

  const advance = () => setIndex((i) => i + 1);

  const handleItemComplete = (id: string, summary: ImportSummary) => {
    onImportComplete(id, summary);
    setCompleted((prev) => [...prev, { name: summary.name, url: summary.url }]);
  };

  if (index >= playlistIds.length) {
    return (
      <div className="glass-panel">
        <div className="badge-wrapper success">🎉 Queue Complete!</div>
        <p className="description-text">
          Moved {completed.length} of {playlistIds.length} playlist{playlistIds.length === 1 ? '' : 's'} to {toMeta.name}.
        </p>

        <div className="log-list history-list">
          {completed.map((p, idx) => (
            <div key={idx} className="log-item success">
              <span className="log-item-raw">{p.name}</span>
              <span className="arrow">➔</span>
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="log-item-spotify">
                Open in {toMeta.name}
              </a>
            </div>
          ))}
        </div>

        <div className="form-actions center-align mt-4">
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <BridgeQueueItem
      key={index}
      index={index}
      total={playlistIds.length}
      playlistId={playlistIds[index]}
      source={source}
      destination={destination}
      sourceApiRequest={sourceApiRequest}
      destApiRequest={destApiRequest}
      onSaveProgress={onSaveProgress}
      onImportComplete={handleItemComplete}
      onAdvance={advance}
      onStop={() => navigate('/')}
    />
  );
};

interface BridgeQueueItemProps {
  index: number;
  total: number;
  playlistId: string;
  source: SourceConnector;
  destination: DestinationConnector;
  sourceApiRequest: ApiRequest;
  destApiRequest: ApiRequest;
  onSaveProgress: BridgeQueueProps['onSaveProgress'];
  onImportComplete: (id: string, summary: ImportSummary) => void;
  onAdvance: () => void;
  onStop: () => void;
}

// A fresh mount per queue item — currentName, tracksForCurrent, and historyId are all
// owned here, so there's no window where one has updated for a new item while another
// still reflects the previous one.
const BridgeQueueItem: React.FC<BridgeQueueItemProps> = ({
  index,
  total,
  playlistId,
  source,
  destination,
  sourceApiRequest,
  destApiRequest,
  onSaveProgress,
  onImportComplete,
  onAdvance,
  onStop,
}) => {
  const [currentName, setCurrentName] = useState('');
  const [tracksForCurrent, setTracksForCurrent] = useState<ParsedTrack[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [connectorExhausted, setConnectorExhausted] = useState(false);
  const historyId = useMemo(() => crypto.randomUUID(), []);

  // 'stopped' means this playlist hit a connector-wide quota/rate-limit exhaustion, not a
  // one-off failure — auto-advancing would almost certainly hit the same wall on the next
  // playlist too, so pause the queue here instead and let the user decide.
  const handleItemDone = (status: 'completed' | 'failed' | 'stopped') => {
    if (status === 'stopped') {
      setConnectorExhausted(true);
    } else {
      onAdvance();
    }
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const name = await source.getPlaylistName(sourceApiRequest, playlistId);
        if (!active) return;
        setCurrentName(name);

        const lines = await source.getPlaylistTrackLines(sourceApiRequest, playlistId);
        if (!active) return;
        setTracksForCurrent(parseTracklist(lines.join('\n')));
      } catch (err: any) {
        if (active) setLoadError(err.message || 'Failed to load this playlist.');
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [playlistId, source, sourceApiRequest]);

  if (loadError) {
    return (
      <div className="glass-panel">
        <h2>❌ Something went wrong</h2>
        <p className="description-text">{loadError}</p>
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onStop}>
            ← Stop Queue
          </button>
          {index + 1 < total && (
            <button className="btn btn-outline" onClick={onAdvance}>
              Skip to Next Playlist →
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!tracksForCurrent) {
    return (
      <div className="glass-panel center-align">
        <div className="spinner">
          Loading playlist {index + 1} of {total}...
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="glass-panel center-align" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <p className="description-text" style={{ margin: 0 }}>
          Playlist {index + 1} of {total}: <strong>{currentName}</strong>
        </p>
      </div>
      <ImporterProgress
        tracks={tracksForCurrent}
        playlistName={currentName}
        playlistDesc="Imported via TransferMusic (github.com/yankvasya/transfer-music)"
        isPublic={false}
        apiRequest={destApiRequest}
        connector={destination}
        onRestart={onStop}
        onBackToList={onStop}
        historyId={historyId}
        onSaveProgress={onSaveProgress}
        onImportComplete={onImportComplete}
        onDone={handleItemDone}
      />
      {connectorExhausted && (
        <div className="glass-panel center-align" style={{ marginTop: '1.5rem' }}>
          <p className="description-text">
            This playlist stopped early (see the message above) — since it's usually a connector-wide limit, the rest of the
            queue would likely hit it immediately too.
          </p>
          <div className="form-actions center-align">
            <button className="btn btn-secondary" onClick={onStop}>
              ← Stop Queue
            </button>
            {index + 1 < total && (
              <button className="btn btn-outline" onClick={onAdvance}>
                Skip to Next Playlist →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
