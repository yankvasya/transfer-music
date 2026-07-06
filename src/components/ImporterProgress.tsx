import React, { useState, useEffect, useRef } from 'react';
import type { ParsedTrack } from '../utils/parser';
import type { MatchResult, ResumeData } from '../types';

const CONCURRENCY = 5; // parallel searches; keep modest to stay well under Spotify's rate limits
const PERSIST_EVERY = 20; // tracks between resumable checkpoints
const VISIBLE_LIMIT = 10;

interface ImporterProgressProps {
  tracks: ParsedTrack[];
  playlistName: string;
  playlistDesc: string;
  isPublic: boolean;
  apiRequest: (endpoint: string, options?: RequestInit) => Promise<any>;
  onRestart: () => void;
  onBackToList: () => void;
  historyId: string;
  resumeFrom?: ResumeData;
  onSaveProgress: (
    id: string,
    summary: { name: string; url: string; matched: number; failed: number; total: number },
    resumeData: ResumeData
  ) => void;
  onImportComplete: (
    id: string,
    summary: { name: string; url: string; matched: number; failed: number; total: number }
  ) => void;
}

interface LogPanelProps {
  title: string;
  items: MatchResult[];
  emptyLabel: string;
  headerExtra?: React.ReactNode;
  renderItem: (item: MatchResult, idx: number) => React.ReactNode;
}

const LogPanel: React.FC<LogPanelProps> = ({ title, items, emptyLabel, headerExtra, renderItem }) => {
  const [expanded, setExpanded] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const hasMore = items.length > VISIBLE_LIMIT;
  const visible = expanded ? items : items.slice(0, VISIBLE_LIMIT);

  const scrollToTop = () => listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <div className="log-panel">
      <div className="log-header-row">
        <h4>{title} ({items.length})</h4>
        <div className="log-header-actions">
          {headerExtra}
          {expanded && hasMore && (
            <button type="button" className="btn btn-sm btn-outline" onClick={scrollToTop}>
              ↑ Top
            </button>
          )}
          {hasMore && (
            <button type="button" className="btn btn-sm btn-outline" onClick={() => setExpanded((e) => !e)}>
              {expanded ? 'Collapse' : `Show all ${items.length}`}
            </button>
          )}
        </div>
      </div>
      <div className="log-list" ref={listRef}>
        {visible.map(renderItem)}
        {items.length === 0 && <div className="empty-log">{emptyLabel}</div>}
      </div>
      {expanded && hasMore && (
        <button type="button" className="btn btn-sm btn-outline log-collapse-bottom" onClick={() => setExpanded(false)}>
          ↑ Collapse
        </button>
      )}
    </div>
  );
};

export const ImporterProgress: React.FC<ImporterProgressProps> = ({
  tracks,
  playlistName,
  playlistDesc,
  isPublic,
  apiRequest,
  onRestart,
  onBackToList,
  historyId,
  resumeFrom,
  onSaveProgress,
  onImportComplete,
}) => {
  const [status, setStatus] = useState<'creating' | 'importing' | 'paused' | 'completed' | 'failed'>('creating');
  const [progress, setProgress] = useState(0); // 0 to 100
  const [currentIndex, setCurrentIndex] = useState(resumeFrom?.startIndex ?? 0);
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(resumeFrom?.playlistUrl ?? null);

  const [matchedTracks, setMatchedTracks] = useState<MatchResult[]>(resumeFrom?.matchedTracks ?? []);
  const [failedTracks, setFailedTracks] = useState<MatchResult[]>(resumeFrom?.failedTracks ?? []);

  const [currentActionMsg, setCurrentActionMsg] = useState('Initializing...');

  const isPausedRef = useRef(false);
  const isCancelledRef = useRef(false);

  // Buffer of matched URIs not yet flushed to the playlist (max 100 per Spotify API call)
  const pendingUrisRef = useRef<string[]>(resumeFrom?.pendingUris ?? []);
  // Mirrors of the state above, so async workers always read the latest value without stale closures
  const matchedTracksRef = useRef<MatchResult[]>(resumeFrom?.matchedTracks ?? []);
  const failedTracksRef = useRef<MatchResult[]>(resumeFrom?.failedTracks ?? []);
  const importIdRef = useRef(historyId);

  // Toggle pause state
  const handlePauseToggle = () => {
    if (status === 'importing') {
      isPausedRef.current = true;
      setStatus('paused');
      setCurrentActionMsg('Paused. Waiting to resume...');
    } else if (status === 'paused') {
      isPausedRef.current = false;
      setStatus('importing');
    }
  };

  // Stop import early; the in-flight requests wind down on their own (checked below),
  // and whatever was completed so far stays saved as a resumable "incomplete" entry.
  const handleCancel = () => {
    if (confirm('Are you sure you want to stop the import process? Progress so far will be saved so you can resume later from History.')) {
      isCancelledRef.current = true;
      setCurrentActionMsg('Stopping import...');
    }
  };

  // Download failed tracks as text file
  const downloadFailedTracks = () => {
    const textContent = failedTracks
      .map((item) => item.track.raw)
      .join('\n');
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `failed_tracks_${playlistName.replace(/\s+/g, '_')}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Main Importer Loop
  useEffect(() => {
    let active = true;

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    const waitWhilePaused = async () => {
      while (isPausedRef.current && active && !isCancelledRef.current) {
        await sleep(300);
      }
    };

    const startImport = async () => {
      try {
        let playlistId: string;
        let url: string;

        if (resumeFrom) {
          playlistId = resumeFrom.playlistId;
          url = resumeFrom.playlistUrl;
          setPlaylistUrl(url);
          setStatus('importing');
        } else {
          setCurrentActionMsg(`Creating playlist: "${playlistName}"...`);
          const playlistData = await apiRequest('/me/playlists', {
            method: 'POST',
            body: JSON.stringify({
              name: playlistName,
              description: playlistDesc,
              public: isPublic,
            }),
          });
          if (!active || isCancelledRef.current) return;
          playlistId = playlistData.id;
          url = playlistData.external_urls.spotify;
          setPlaylistUrl(url);
          setStatus('importing');
        }

        // Tracks the safe-to-resume prefix: index i is only "done" once its search+add
        // has actually completed, which (under concurrency) isn't the same as "highest
        // index claimed". Resuming from a contiguous done-prefix means we never silently
        // skip a track that was merely in-flight when the tab closed.
        const doneFlags = new Array<boolean>(tracks.length).fill(false);
        for (let i = 0; i < (resumeFrom?.startIndex ?? 0); i++) doneFlags[i] = true;
        const computeSafeStartIndex = () => {
          let i = 0;
          while (i < doneFlags.length && doneFlags[i]) i++;
          return i;
        };

        const flushBatchToPlaylist = async () => {
          if (pendingUrisRef.current.length === 0) return;
          const urisToAdd = [...pendingUrisRef.current];
          pendingUrisRef.current = []; // Clear buffer immediately to prevent double adds

          setCurrentActionMsg(`Adding ${urisToAdd.length} tracks to your playlist...`);

          let success = false;
          while (!success && active && !isCancelledRef.current) {
            await waitWhilePaused();
            if (!active || isCancelledRef.current) return;

            const res = await apiRequest(`/playlists/${playlistId}/items`, {
              method: 'POST',
              body: JSON.stringify({ uris: urisToAdd }),
            });

            if (res && res.isRateLimited) {
              let waitSec = res.waitSeconds;
              while (waitSec > 0 && active && !isCancelledRef.current) {
                await waitWhilePaused();
                setCurrentActionMsg(`Rate limited by Spotify! Retrying in ${waitSec}s...`);
                await sleep(1000);
                waitSec--;
              }
            } else {
              success = true;
            }
          }
        };

        const persistProgress = () => {
          onSaveProgress(
            importIdRef.current,
            {
              name: playlistName,
              url,
              matched: matchedTracksRef.current.length,
              failed: failedTracksRef.current.length,
              total: tracks.length,
            },
            {
              playlistId,
              playlistUrl: url,
              playlistDesc,
              isPublic,
              tracks,
              startIndex: computeSafeStartIndex(),
              matchedTracks: matchedTracksRef.current,
              failedTracks: failedTracksRef.current,
              pendingUris: pendingUrisRef.current,
            }
          );
        };

        // If we're resuming with a leftover unflushed batch, get it onto the playlist
        // before continuing, so it isn't at risk of being lost a second time.
        if (resumeFrom && pendingUrisRef.current.length > 0) {
          await flushBatchToPlaylist();
        }

        let doneCounter = resumeFrom?.startIndex ?? 0;

        const processTrack = async (track: ParsedTrack, index: number) => {
          await waitWhilePaused();
          if (!active || isCancelledRef.current) return;

          const query = track.artist ? `artist:${track.artist} track:${track.title}` : track.title;
          let searchResult: any = null;
          let searchSuccess = false;

          while (!searchSuccess && active && !isCancelledRef.current) {
            await waitWhilePaused();
            if (!active || isCancelledRef.current) return;

            try {
              const res = await apiRequest(`/search?q=${encodeURIComponent(query)}&type=track&limit=1`);

              if (res && res.isRateLimited) {
                let waitSec = res.waitSeconds;
                while (waitSec > 0 && active && !isCancelledRef.current) {
                  await waitWhilePaused();
                  setCurrentActionMsg(`Rate limited! Waiting ${waitSec}s...`);
                  await sleep(1000);
                  waitSec--;
                }
              } else {
                searchResult = res;
                searchSuccess = true;
              }
            } catch (err: any) {
              console.error(`Search error for track "${track.raw}":`, err);
              searchResult = null;
              searchSuccess = true; // Break loop, treat as search fail
            }
          }

          if (!active || isCancelledRef.current) return;

          const spotifyTrack = searchResult?.tracks?.items?.[0];
          if (spotifyTrack) {
            const result: MatchResult = {
              track,
              spotifyName: spotifyTrack.name,
              spotifyArtist: spotifyTrack.artists.map((a: any) => a.name).join(', '),
              uri: spotifyTrack.uri,
              url: spotifyTrack.external_urls.spotify,
              success: true,
            };
            matchedTracksRef.current = [result, ...matchedTracksRef.current];
            setMatchedTracks(matchedTracksRef.current);
            pendingUrisRef.current.push(spotifyTrack.uri);
          } else {
            const result: MatchResult = {
              track,
              success: false,
              errorReason: 'Track not found on Spotify',
            };
            failedTracksRef.current = [result, ...failedTracksRef.current];
            setFailedTracks(failedTracksRef.current);
          }

          doneFlags[index] = true;

          // If buffer has 100 items, flush to Spotify playlist to stay under limits
          if (pendingUrisRef.current.length >= 100) {
            await flushBatchToPlaylist();
          }

          doneCounter++;
          setCurrentIndex(doneCounter);
          setProgress(Math.round((doneCounter / tracks.length) * 100));
          setCurrentActionMsg(`Searching tracks... (${doneCounter} / ${tracks.length} processed)`);

          if (doneCounter % PERSIST_EVERY === 0) {
            persistProgress();
          }
        };

        // Concurrent worker pool: each worker claims the next unprocessed index and
        // works through it, so several searches are in flight at once instead of one at a time.
        let cursor = resumeFrom?.startIndex ?? 0;
        const worker = async () => {
          while (true) {
            if (!active || isCancelledRef.current) return;
            await waitWhilePaused();
            if (!active || isCancelledRef.current || cursor >= tracks.length) return;
            const index = cursor++;
            await processTrack(tracks[index], index);
          }
        };

        await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

        if (!active) return;

        // Final flush for remaining tracks in buffer
        if (pendingUrisRef.current.length > 0) {
          await flushBatchToPlaylist();
        }

        if (!active) return;

        if (isCancelledRef.current) {
          persistProgress();
          setStatus('completed');
          setCurrentActionMsg('Import stopped. Resume it anytime from History.');
        } else {
          setProgress(100);
          setCurrentIndex(tracks.length);
          setStatus('completed');
          setCurrentActionMsg('Playlist import completed successfully!');
          onImportComplete(importIdRef.current, {
            name: playlistName,
            url,
            matched: matchedTracksRef.current.length,
            failed: failedTracksRef.current.length,
            total: tracks.length,
          });
        }
      } catch (err: any) {
        console.error('Import failed with critical error:', err);
        if (active) {
          setStatus('failed');
          setCurrentActionMsg(`Critical Error: ${err.message || 'Something went wrong.'}`);
        }
      }
    };

    startImport();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks, playlistName, playlistDesc, isPublic, apiRequest, historyId]);

  return (
    <div className="importer-progress-panel glass-panel">
      <h2>🚀 Importing Playlist</h2>
      <p className="description-text">{currentActionMsg}</p>

      {/* Progress Bar Container */}
      <div className="progress-container">
        <div className="progress-bar-bg">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
        </div>
        <div className="progress-labels">
          <span>{progress}% Completed</span>
          <span>{currentIndex} / {tracks.length} tracks processed</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stats-row">
        <div className="stat-card success">
          <div className="stat-value">{matchedTracks.length}</div>
          <div className="stat-label">Successfully Matched</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-value">{failedTracks.length}</div>
          <div className="stat-label">Not Found</div>
        </div>
      </div>

      {/* Control Actions during Import */}
      {(status === 'importing' || status === 'paused') && (
        <div className="form-actions center-align">
          <button className="btn btn-outline" onClick={handlePauseToggle}>
            {status === 'paused' ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button className="btn btn-danger" onClick={handleCancel}>
            ⏹ Stop Import
          </button>
        </div>
      )}

      {/* Complete/Failed Screen */}
      {(status === 'completed' || status === 'failed') && (
        <div className="completion-card">
          {status === 'completed' ? (
            <div className="badge-wrapper success">🎉 Done!</div>
          ) : (
            <div className="badge-wrapper danger">❌ Failed</div>
          )}
          {playlistUrl && <h3 className="completion-playlist-name">{playlistName}</h3>}

          <div className="form-actions center-align mt-4">
            {playlistUrl && (
              <a href={playlistUrl} target="_blank" rel="noopener noreferrer" className="btn btn-success btn-lg">
                🟢 Open Spotify Playlist
              </a>
            )}
            <button className="btn btn-outline" onClick={onBackToList}>
              ← Back to Tracklist
            </button>
            <button className="btn btn-primary" onClick={onRestart}>
              Import Another Playlist
            </button>
          </div>
        </div>
      )}

      {/* Output Lists */}
      <div className="log-container">
        <LogPanel
          title="Matched"
          items={matchedTracks}
          emptyLabel="No tracks matched yet..."
          renderItem={(item, idx) => (
            <div key={idx} className="log-item success">
              <span className="log-item-raw">{item.track.raw}</span>
              <span className="arrow">➔</span>
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="log-item-spotify">
                {item.spotifyArtist} - {item.spotifyName}
              </a>
            </div>
          )}
        />

        <LogPanel
          title="Not Found"
          items={failedTracks}
          emptyLabel="No missed tracks..."
          headerExtra={
            failedTracks.length > 0 ? (
              <button className="btn btn-sm btn-outline-danger" onClick={downloadFailedTracks}>
                ⬇ Download List
              </button>
            ) : undefined
          }
          renderItem={(item, idx) => (
            <div key={idx} className="log-item danger">
              <span className="log-item-raw">{item.track.raw}</span>
              <span className="log-item-error">({item.errorReason})</span>
            </div>
          )}
        />
      </div>
    </div>
  );
};
