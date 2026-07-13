import React, { useState, useEffect, useRef } from 'react';
import { parseTracklist } from '../utils/parser';
import type { ParsedTrack } from '../utils/parser';
import type { ImportSummary, MatchResult, ResumeData, ReviewTrack, TrackCandidate } from '../types';
import type { ApiRequest, DestinationConnector } from '../connectors/types';
import { SERVICE_META } from '../serviceMeta';

const CONCURRENCY = 5; // parallel searches; keep modest to stay well under most APIs' rate limits
const PERSIST_EVERY = 20; // tracks between resumable checkpoints
const VISIBLE_LIMIT = 10;
// Real-world Development Mode lockouts have been reported lasting minutes to hours, not
// seconds — so after this many rate-limited responses in a row (across all concurrent
// workers), stop instead of hammering an API that has already told us "no" repeatedly.
const MAX_CONSECUTIVE_RATE_LIMITS = 15;
// Module-level (not component-level) on purpose — see the claim check inside startImport.
const playlistCreationClaimed = new Set<string>();

interface ImporterProgressProps {
  tracks: ParsedTrack[];
  playlistName: string;
  playlistDesc: string;
  isPublic: boolean;
  apiRequest: ApiRequest;
  connector: DestinationConnector;
  onRestart: () => void;
  onBackToList: () => void;
  historyId: string;
  resumeFrom?: ResumeData;
  onSaveProgress: (id: string, summary: ImportSummary, resumeData: ResumeData) => void;
  onImportComplete: (id: string, summary: ImportSummary) => void;
  // Fires once, a short delay after this run reaches a terminal state — lets a caller
  // (e.g. a bulk multi-playlist queue) react without polling internal status. 'stopped'
  // (quota/rate-limit exhaustion) is reported separately from 'completed' because it is
  // NOT safe to treat as "move on to the next item": the same connector-wide limit will
  // very likely hit the next item immediately too.
  onDone?: (status: 'completed' | 'failed' | 'stopped') => void;
}

interface LogPanelProps<T> {
  title: string;
  items: T[];
  emptyLabel: string;
  headerExtra?: React.ReactNode;
  renderItem: (item: T, idx: number) => React.ReactNode;
}

function LogPanel<T>({ title, items, emptyLabel, headerExtra, renderItem }: LogPanelProps<T>) {
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
}

export const ImporterProgress: React.FC<ImporterProgressProps> = ({
  tracks,
  playlistName,
  playlistDesc,
  isPublic,
  apiRequest,
  connector,
  onRestart,
  onBackToList,
  historyId,
  resumeFrom,
  onSaveProgress,
  onImportComplete,
  onDone,
}) => {
  const [status, setStatus] = useState<'creating' | 'importing' | 'paused' | 'completed' | 'failed' | 'stopped'>('creating');
  const [progress, setProgress] = useState(0); // 0 to 100
  const [currentIndex, setCurrentIndex] = useState(resumeFrom?.startIndex ?? 0);
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(resumeFrom?.playlistUrl ?? null);
  // Exposed as state (not just a local var inside the import effect) so the manual
  // re-match action below can add a track to the right playlist after the main loop ends.
  const [playlistId, setPlaylistId] = useState<string | null>(resumeFrom?.playlistId ?? null);

  const [matchedTracks, setMatchedTracks] = useState<MatchResult[]>(resumeFrom?.matchedTracks ?? []);
  const [failedTracks, setFailedTracks] = useState<MatchResult[]>(resumeFrom?.failedTracks ?? []);
  const [duplicateTracks, setDuplicateTracks] = useState<MatchResult[]>(resumeFrom?.duplicateTracks ?? []);
  const [reviewTracks, setReviewTracks] = useState<ReviewTrack[]>(resumeFrom?.reviewTracks ?? []);

  const [currentActionMsg, setCurrentActionMsg] = useState('Initializing...');

  const isPausedRef = useRef(false);
  const isCancelledRef = useRef(false);
  const stopReasonRef = useRef<'user' | 'rate_limit' | 'quota_exceeded' | null>(null);

  // Buffer of matched external IDs not yet flushed to the playlist (connector.batchSize per call)
  const pendingUrisRef = useRef<string[]>(resumeFrom?.pendingUris ?? []);
  // Mirrors of the state above, so async workers always read the latest value without stale closures
  const matchedTracksRef = useRef<MatchResult[]>(resumeFrom?.matchedTracks ?? []);
  const failedTracksRef = useRef<MatchResult[]>(resumeFrom?.failedTracks ?? []);
  const duplicateTracksRef = useRef<MatchResult[]>(resumeFrom?.duplicateTracks ?? []);
  const reviewTracksRef = useRef<ReviewTrack[]>(resumeFrom?.reviewTracks ?? []);
  // Every externalId already claimed by a matched track in this import, so a second input
  // line resolving to the same real track gets skipped instead of added twice.
  const claimedExternalIdsRef = useRef<Set<string>>(
    new Set((resumeFrom?.matchedTracks ?? []).map((m) => m.externalId).filter((id): id is string => !!id))
  );
  const importIdRef = useRef(historyId);
  // Mirrors playlistId/playlistUrl state for the same reason as the refs above, plus one
  // more: they need to be readable from startImport's catch block, which — being a
  // sibling block to the try, not nested inside it — can't see the try-scoped local
  // `playlistId`/`url` variables at all.
  const playlistIdRef = useRef<string | null>(resumeFrom?.playlistId ?? null);
  const playlistUrlRef = useRef<string | null>(resumeFrom?.playlistUrl ?? null);

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
      stopReasonRef.current = 'user';
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
      // Declared before the try so both the main loop and the catch block below can reach
      // them — a crash partway through (e.g. the destination playlist hit its max size)
      // should still leave an accurate, immediately resumable History entry rather than
      // relying on whatever the last periodic checkpoint happened to catch.
      const doneFlags = new Array<boolean>(tracks.length).fill(false);
      for (let i = 0; i < (resumeFrom?.startIndex ?? 0); i++) doneFlags[i] = true;
      const computeSafeStartIndex = () => {
        let i = 0;
        while (i < doneFlags.length && doneFlags[i]) i++;
        return i;
      };
      const persistProgress = () => {
        if (!playlistIdRef.current || !playlistUrlRef.current) return;
        onSaveProgress(
          importIdRef.current,
          {
            service: connector.id,
            name: playlistName,
            url: playlistUrlRef.current,
            matched: matchedTracksRef.current.length,
            failed: failedTracksRef.current.length,
            duplicates: duplicateTracksRef.current.length,
            needsReview: reviewTracksRef.current.length,
            total: tracks.length,
          },
          {
            service: connector.id,
            playlistId: playlistIdRef.current,
            playlistUrl: playlistUrlRef.current,
            playlistDesc,
            isPublic,
            tracks,
            startIndex: computeSafeStartIndex(),
            matchedTracks: matchedTracksRef.current,
            failedTracks: failedTracksRef.current,
            duplicateTracks: duplicateTracksRef.current,
            reviewTracks: reviewTracksRef.current,
            pendingUris: pendingUrisRef.current,
          }
        );
      };

      try {
        let playlistId: string;
        let url: string;

        if (resumeFrom) {
          playlistId = resumeFrom.playlistId;
          url = resumeFrom.playlistUrl;
          playlistIdRef.current = playlistId;
          playlistUrlRef.current = url;
          setPlaylistUrl(url);
          setPlaylistId(playlistId);
          setStatus('importing');
        } else {
          // React can render a duplicate, short-lived instance of this component for the
          // same historyId in some navigation scenarios; claiming historyId synchronously
          // here (before any await) ensures only one instance ever actually creates a
          // playlist, regardless of how many instances briefly coexist.
          if (playlistCreationClaimed.has(historyId)) return;
          playlistCreationClaimed.add(historyId);

          setCurrentActionMsg(`Creating playlist: "${playlistName}"...`);
          const playlistData = await connector.createPlaylist(apiRequest, playlistName, playlistDesc, isPublic);
          if (!active || isCancelledRef.current) return;
          playlistId = playlistData.id;
          url = playlistData.url;
          playlistIdRef.current = playlistId;
          playlistUrlRef.current = url;
          setPlaylistUrl(url);
          setPlaylistId(playlistId);
          setStatus('importing');
        }

        // Shared across all concurrent workers: how many rate-limited responses have come
        // back in a row (reset on any successful request). Once it crosses the threshold,
        // we give up rather than keep waiting out an already-lengthy lockout.
        let rateLimitStreak = 0;
        const registerRateLimit = () => {
          rateLimitStreak++;
          if (rateLimitStreak > MAX_CONSECUTIVE_RATE_LIMITS) {
            stopReasonRef.current = 'rate_limit';
            isCancelledRef.current = true;
            return true;
          }
          return false;
        };
        const registerSuccess = () => {
          rateLimitStreak = 0;
        };
        // A quota error (e.g. YouTube's daily cap) can't be waited out within this session —
        // stop immediately rather than treating it like a transient rate limit.
        const registerQuotaExceeded = () => {
          stopReasonRef.current = 'quota_exceeded';
          isCancelledRef.current = true;
        };

        // Serializes connector.addTracks calls across all CONCURRENCY workers, which
        // otherwise share one flush buffer and can each independently trigger a flush at
        // nearly the same time. Harmless for most connectors, but required for Yandex:
        // its mutation API fetches a revision number and submits a diff against it, so two
        // calls in flight together can both read the same (stale) revision and race — the
        // second gets rejected. Chaining the lock's promise instead of tracking a busy flag
        // means each waiter resumes in the order it arrived, without a manual queue.
        let addTracksLock: Promise<void> = Promise.resolve();
        const withAddTracksLock = async <T,>(fn: () => Promise<T>): Promise<T> => {
          const myTurn = addTracksLock;
          let release: () => void = () => {};
          addTracksLock = new Promise((resolve) => {
            release = resolve;
          });
          await myTurn;
          try {
            return await fn();
          } finally {
            release();
          }
        };

        const flushBatchToPlaylist = async () => {
          if (pendingUrisRef.current.length === 0) return;
          const urisToAdd = [...pendingUrisRef.current];
          pendingUrisRef.current = []; // Clear buffer immediately to prevent double adds

          setCurrentActionMsg(`Adding ${urisToAdd.length} track${urisToAdd.length === 1 ? '' : 's'} to your playlist...`);

          let success = false;
          while (!success && active && !isCancelledRef.current) {
            await waitWhilePaused();
            if (!active || isCancelledRef.current) break;

            let res;
            try {
              res = await withAddTracksLock(() => connector.addTracks(apiRequest, playlistId, urisToAdd));
            } catch (err) {
              // A hard failure here (e.g. the destination playlist rejected the add because
              // it hit its own max size) throws rather than returning a status — restore the
              // batch before propagating so the crash-time checkpoint the outer catch saves
              // still has these tracks in pendingUris instead of silently losing them.
              pendingUrisRef.current = [...urisToAdd, ...pendingUrisRef.current];
              throw err;
            }

            if (res.status === 'quota_exceeded') {
              registerQuotaExceeded();
              break;
            } else if (res.status === 'rate_limited') {
              if (registerRateLimit()) break;
              let waitSec = res.waitSeconds;
              while (waitSec > 0 && active && !isCancelledRef.current) {
                await waitWhilePaused();
                setCurrentActionMsg(`Rate limited by ${connector.label}! Retrying in ${waitSec}s...`);
                await sleep(1000);
                waitSec--;
              }
            } else {
              registerSuccess();
              success = true;
            }
          }

          if (!success) {
            // Couldn't add this batch (cancelled/rate-limited out) — put it back so it
            // isn't silently lost; it'll be retried on the next flush or on resume.
            pendingUrisRef.current = [...urisToAdd, ...pendingUrisRef.current];
          }
        };

        // If we're resuming with a leftover unflushed batch, get it onto the playlist
        // before continuing, so it isn't at risk of being lost a second time.
        if (resumeFrom && pendingUrisRef.current.length > 0) {
          await flushBatchToPlaylist();
        }

        // Checkpoint immediately so even an interruption in the first few seconds
        // (before the first periodic save) leaves something resumable in History.
        if (!resumeFrom) {
          persistProgress();
        }

        let doneCounter = resumeFrom?.startIndex ?? 0;

        const processTrack = async (track: ParsedTrack, index: number) => {
          await waitWhilePaused();
          if (!active || isCancelledRef.current) return;

          let searchDone = false;

          while (!searchDone && active && !isCancelledRef.current) {
            await waitWhilePaused();
            if (!active || isCancelledRef.current) return;

            try {
              const res = await connector.searchTrack(apiRequest, track);

              if (res.status === 'quota_exceeded') {
                registerQuotaExceeded();
                return;
              } else if (res.status === 'rate_limited') {
                if (registerRateLimit()) return;
                let waitSec = res.waitSeconds;
                while (waitSec > 0 && active && !isCancelledRef.current) {
                  await waitWhilePaused();
                  setCurrentActionMsg(`Rate limited! Waiting ${waitSec}s...`);
                  await sleep(1000);
                  waitSec--;
                }
              } else if (res.status === 'found') {
                registerSuccess();
                if (claimedExternalIdsRef.current.has(res.externalId)) {
                  // Another line in this same import already resolved to this exact
                  // track — skip adding it again rather than duplicating it.
                  const duplicate: MatchResult = {
                    track,
                    matchedName: res.matchedTitle,
                    matchedArtist: res.matchedArtist,
                    externalId: res.externalId,
                    url: res.url,
                    success: true,
                    isDuplicate: true,
                  };
                  duplicateTracksRef.current = [duplicate, ...duplicateTracksRef.current];
                  setDuplicateTracks(duplicateTracksRef.current);
                } else {
                  claimedExternalIdsRef.current.add(res.externalId);
                  const result: MatchResult = {
                    track,
                    matchedName: res.matchedTitle,
                    matchedArtist: res.matchedArtist,
                    externalId: res.externalId,
                    url: res.url,
                    success: true,
                  };
                  matchedTracksRef.current = [result, ...matchedTracksRef.current];
                  setMatchedTracks(matchedTracksRef.current);
                  pendingUrisRef.current.push(res.externalId);
                }
                searchDone = true;
              } else if (res.status === 'needs_review') {
                registerSuccess();
                reviewTracksRef.current = [{ track, candidates: res.candidates }, ...reviewTracksRef.current];
                setReviewTracks(reviewTracksRef.current);
                searchDone = true;
              } else {
                registerSuccess();
                const result: MatchResult = {
                  track,
                  success: false,
                  errorReason: `Track not found on ${connector.label}`,
                };
                failedTracksRef.current = [result, ...failedTracksRef.current];
                setFailedTracks(failedTracksRef.current);
                searchDone = true;
              }
            } catch (err: any) {
              console.error(`Search error for track "${track.raw}":`, err);
              const result: MatchResult = {
                track,
                success: false,
                errorReason: `Search failed for this track on ${connector.label}`,
              };
              failedTracksRef.current = [result, ...failedTracksRef.current];
              setFailedTracks(failedTracksRef.current);
              searchDone = true; // Break loop, treat as search fail
            }
          }

          if (!active || isCancelledRef.current) return;

          doneFlags[index] = true;

          // If buffer has reached this connector's batch limit, flush to the playlist.
          if (pendingUrisRef.current.length >= connector.batchSize) {
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
          // A connector-wide quota/rate-limit exhaustion will very likely hit the next
          // item too, unlike a user-initiated stop of just this one playlist — kept as
          // its own status so callers (the bulk queue) don't treat it as safe to move on.
          const exhausted = stopReasonRef.current === 'quota_exceeded' || stopReasonRef.current === 'rate_limit';
          setStatus(exhausted ? 'stopped' : 'completed');
          if (stopReasonRef.current === 'quota_exceeded') {
            setCurrentActionMsg(
              `Stopped: ${connector.label}'s daily API quota ran out. This resets on its own (YouTube resets at midnight Pacific Time) — your progress is saved, resume from History once it clears.`
            );
          } else if (stopReasonRef.current === 'rate_limit') {
            setCurrentActionMsg(
              `Stopped: ${connector.label} kept rate-limiting this app even after waiting it out. Lockouts like this have been reported lasting anywhere from minutes to several hours, so retrying immediately won't help — your progress is saved, resume from History once it clears.`
            );
          } else {
            setCurrentActionMsg('Import stopped. Resume it anytime from History.');
          }
        } else {
          setProgress(100);
          setCurrentIndex(tracks.length);
          setStatus('completed');
          setCurrentActionMsg('Playlist import completed successfully!');
          onImportComplete(importIdRef.current, {
            service: connector.id,
            name: playlistName,
            url,
            matched: matchedTracksRef.current.length,
            failed: failedTracksRef.current.length,
            duplicates: duplicateTracksRef.current.length,
            needsReview: reviewTracksRef.current.length,
            total: tracks.length,
          });
        }
      } catch (err: any) {
        console.error('Import failed with critical error:', err);
        if (active) {
          // The playlist may already have several batches successfully added — e.g. this
          // is exactly what happens if the destination service rejects further adds
          // because the playlist hit its own max size. Persist an up-to-date checkpoint
          // (not just whatever the last periodic save happened to catch) so this shows up
          // in History as resumable instead of just vanishing as a dead-end error.
          persistProgress();
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
  }, [tracks, playlistName, playlistDesc, isPublic, apiRequest, connector, historyId]);

  // Notifies a caller (e.g. a bulk queue) once this run is truly finished. A short delay
  // gives the completed/failed screen a moment to actually be seen before advancing.
  useEffect(() => {
    if (status !== 'completed' && status !== 'failed' && status !== 'stopped') return;
    if (!onDone) return;
    const finalStatus = status;
    const timer = setTimeout(() => onDone(finalStatus), 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Manual re-match for a "Not Found" track: lets the user edit the search query (fix a
  // typo, drop a noisy word, etc.) and try again, available once the main loop has
  // finished and a playlist actually exists to add into.
  const [retryQueries, setRetryQueries] = useState<Record<string, string>>({});
  const [retryStatus, setRetryStatus] = useState<Record<string, 'idle' | 'searching' | 'not_found' | 'error'>>({});

  const refreshHistorySummary = () => {
    if (!playlistUrl) return;
    onImportComplete(importIdRef.current, {
      service: connector.id,
      name: playlistName,
      url: playlistUrl,
      matched: matchedTracksRef.current.length,
      failed: failedTracksRef.current.length,
      duplicates: duplicateTracksRef.current.length,
      needsReview: reviewTracksRef.current.length,
      total: tracks.length,
    });
  };

  const handleRetry = async (item: MatchResult) => {
    const key = item.track.raw;
    const queryText = (retryQueries[key] ?? `${item.track.artist} - ${item.track.title}`).trim();
    if (!queryText || !playlistId) return;

    setRetryStatus((s) => ({ ...s, [key]: 'searching' }));

    // Reparses the edited text the same way pasted input is parsed, so a retry goes
    // through the exact same search path as a normal import.
    const [reparsed] = parseTracklist(queryText);

    try {
      const res = await connector.searchTrack(apiRequest, reparsed);

      if (res.status !== 'found') {
        setRetryStatus((s) => ({ ...s, [key]: 'not_found' }));
        return;
      }

      const isDuplicate = claimedExternalIdsRef.current.has(res.externalId);
      if (!isDuplicate) {
        const addRes = await connector.addTracks(apiRequest, playlistId, [res.externalId]);
        if (addRes.status !== 'ok') {
          setRetryStatus((s) => ({ ...s, [key]: 'error' }));
          return;
        }
        claimedExternalIdsRef.current.add(res.externalId);
      }

      const result: MatchResult = {
        track: item.track,
        matchedName: res.matchedTitle,
        matchedArtist: res.matchedArtist,
        externalId: res.externalId,
        url: res.url,
        success: true,
        isDuplicate,
      };

      if (isDuplicate) {
        duplicateTracksRef.current = [result, ...duplicateTracksRef.current];
        setDuplicateTracks(duplicateTracksRef.current);
      } else {
        matchedTracksRef.current = [result, ...matchedTracksRef.current];
        setMatchedTracks(matchedTracksRef.current);
      }

      failedTracksRef.current = failedTracksRef.current.filter((f) => f.track.raw !== key);
      setFailedTracks(failedTracksRef.current);
      setRetryStatus((s) => ({ ...s, [key]: 'idle' }));
      refreshHistorySummary();
    } catch (err: any) {
      console.error(`Retry failed for track "${key}":`, err);
      setRetryStatus((s) => ({ ...s, [key]: 'error' }));
    }
  };

  // Sequential (not parallel) on purpose — this reuses handleRetry's per-track path
  // one at a time rather than hammering the connector with N concurrent requests, since
  // these are tracks that already failed once and may be more rate-limit-sensitive.
  const [retryAllRunning, setRetryAllRunning] = useState(false);

  const handleRetryAll = async () => {
    if (retryAllRunning) return;
    setRetryAllRunning(true);
    const toRetry = [...failedTracksRef.current];
    for (const item of toRetry) {
      await handleRetry(item);
    }
    setRetryAllRunning(false);
  };

  // Resolving a "Needs Review" track: the user either picks one of the candidates
  // (added immediately, same as a manual re-match) or rejects all of them, which moves
  // it to Not Found so it can be searched manually via the existing retry flow there.
  const [reviewStatus, setReviewStatus] = useState<Record<string, 'idle' | 'busy' | 'error'>>({});

  const handleAcceptCandidate = async (item: ReviewTrack, candidate: TrackCandidate) => {
    const key = item.track.raw;
    if (!playlistId) return;
    setReviewStatus((s) => ({ ...s, [key]: 'busy' }));

    try {
      const isDuplicate = claimedExternalIdsRef.current.has(candidate.externalId);
      if (!isDuplicate) {
        const addRes = await connector.addTracks(apiRequest, playlistId, [candidate.externalId]);
        if (addRes.status !== 'ok') {
          setReviewStatus((s) => ({ ...s, [key]: 'error' }));
          return;
        }
        claimedExternalIdsRef.current.add(candidate.externalId);
      }

      const result: MatchResult = {
        track: item.track,
        matchedName: candidate.title,
        matchedArtist: candidate.artist,
        externalId: candidate.externalId,
        url: candidate.url,
        success: true,
        isDuplicate,
      };

      if (isDuplicate) {
        duplicateTracksRef.current = [result, ...duplicateTracksRef.current];
        setDuplicateTracks(duplicateTracksRef.current);
      } else {
        matchedTracksRef.current = [result, ...matchedTracksRef.current];
        setMatchedTracks(matchedTracksRef.current);
      }

      reviewTracksRef.current = reviewTracksRef.current.filter((r) => r.track.raw !== key);
      setReviewTracks(reviewTracksRef.current);
      refreshHistorySummary();
    } catch (err: any) {
      console.error(`Failed to add reviewed track "${key}":`, err);
      setReviewStatus((s) => ({ ...s, [key]: 'error' }));
    }
  };

  const handleRejectReview = (item: ReviewTrack) => {
    const key = item.track.raw;
    reviewTracksRef.current = reviewTracksRef.current.filter((r) => r.track.raw !== key);
    setReviewTracks(reviewTracksRef.current);

    const result: MatchResult = {
      track: item.track,
      success: false,
      errorReason: 'No confident match — search manually below',
    };
    failedTracksRef.current = [result, ...failedTracksRef.current];
    setFailedTracks(failedTracksRef.current);
    refreshHistorySummary();
  };

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
        <div className="stat-card info">
          <div className="stat-value">{reviewTracks.length}</div>
          <div className="stat-label">Needs Review</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-value">{duplicateTracks.length}</div>
          <div className="stat-label">Duplicates Skipped</div>
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
      {(status === 'completed' || status === 'failed' || status === 'stopped') && (
        <div className="completion-card">
          {status === 'completed' ? (
            <div className="badge-wrapper success">🎉 Done!</div>
          ) : status === 'stopped' ? (
            <div className="badge-wrapper warning">⏸ Stopped</div>
          ) : (
            <div className="badge-wrapper danger">❌ Failed</div>
          )}
          {playlistUrl && <h3 className="completion-playlist-name">{playlistName}</h3>}

          <div className="form-actions center-align mt-4">
            {playlistUrl && (
              <a href={playlistUrl} target="_blank" rel="noopener noreferrer" className="btn btn-success btn-lg">
                {SERVICE_META[connector.id].icon} Open {connector.label} Playlist
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
                {item.matchedArtist} - {item.matchedName}
              </a>
            </div>
          )}
        />

        <LogPanel
          title="Needs Review"
          items={reviewTracks}
          emptyLabel="No uncertain matches..."
          renderItem={(item, idx) => {
            const key = item.track.raw;
            const busy = reviewStatus[key] === 'busy';
            return (
              <div key={idx} className="log-item info" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.4rem' }}>
                <span className="log-item-raw">{item.track.raw}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {item.candidates.map((candidate, cIdx) => (
                    <button
                      key={cIdx}
                      type="button"
                      className="candidate-pick-button"
                      onClick={() => handleAcceptCandidate(item, candidate)}
                      disabled={busy}
                    >
                      <span>{candidate.artist} - {candidate.title}</span>
                      <span className="candidate-confidence">{Math.round(candidate.confidence * 100)}%</span>
                    </button>
                  ))}
                </div>
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => handleRejectReview(item)} disabled={busy}>
                  None of these
                </button>
                {reviewStatus[key] === 'error' && <span className="log-item-error">Failed to add — try again.</span>}
              </div>
            );
          }}
        />

        <LogPanel
          title="Duplicates Skipped"
          items={duplicateTracks}
          emptyLabel="No duplicates found..."
          renderItem={(item, idx) => (
            <div key={idx} className="log-item warning">
              <span className="log-item-raw">{item.track.raw}</span>
              <span className="arrow">➔</span>
              <span className="log-item-error" style={{ color: 'var(--text-secondary)' }}>
                already added as {item.matchedArtist} - {item.matchedName}
              </span>
            </div>
          )}
        />

        <LogPanel
          title="Not Found"
          items={failedTracks}
          emptyLabel="No missed tracks..."
          headerExtra={
            failedTracks.length > 0 ? (
              <>
                {playlistId && failedTracks.length > 1 && (
                  <button className="btn btn-sm btn-outline" onClick={handleRetryAll} disabled={retryAllRunning}>
                    {retryAllRunning ? '🔁 Retrying...' : `🔁 Retry All (${failedTracks.length})`}
                  </button>
                )}
                <button className="btn btn-sm btn-outline-danger" onClick={downloadFailedTracks}>
                  ⬇ Download List
                </button>
              </>
            ) : undefined
          }
          renderItem={(item, idx) => {
            const key = item.track.raw;
            const status = retryStatus[key] ?? 'idle';
            return (
              <div key={idx} className="log-item danger" style={playlistId ? { flexDirection: 'column', alignItems: 'stretch', gap: '0.4rem' } : undefined}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: '0.5rem' }}>
                  <span className="log-item-raw">{item.track.raw}</span>
                  <span className="log-item-error">({item.errorReason})</span>
                </div>
                {playlistId && (
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-control retry-input"
                      value={retryQueries[key] ?? `${item.track.artist} - ${item.track.title}`}
                      onChange={(e) => setRetryQueries((q) => ({ ...q, [key]: e.target.value }))}
                      placeholder="Edit search query and retry"
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => handleRetry(item)}
                      disabled={status === 'searching' || retryAllRunning}
                    >
                      {status === 'searching' ? '...' : '🔍 Retry'}
                    </button>
                  </div>
                )}
                {status === 'not_found' && <span className="log-item-error">Still not found — try editing the query.</span>}
                {status === 'error' && <span className="log-item-error">Failed to add — try again.</span>}
              </div>
            );
          }}
        />
      </div>
    </div>
  );
};
