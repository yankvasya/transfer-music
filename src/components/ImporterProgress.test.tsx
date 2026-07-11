import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ImporterProgress } from './ImporterProgress';
import type { DestinationConnector } from '../connectors/types';
import type { ParsedTrack } from '../utils/parser';
import type { ResumeData } from '../types';

function track(raw: string, artist: string, title: string): ParsedTrack {
  return { raw, artist, title, isValid: true };
}

interface ConnectorOverrides {
  batchSize?: number;
  searchTrack?: DestinationConnector['searchTrack'];
  addTracks?: DestinationConnector['addTracks'];
  createPlaylist?: DestinationConnector['createPlaylist'];
}

function makeConnector(overrides: ConnectorOverrides = {}): { connector: DestinationConnector; calls: { created: number; searched: string[]; added: string[][] } } {
  const calls = { created: 0, searched: [] as string[], added: [] as string[][] };

  const connector: DestinationConnector = {
    id: 'spotify',
    label: 'Spotify',
    batchSize: overrides.batchSize ?? 100,
    createPlaylist:
      overrides.createPlaylist ??
      (async () => {
        calls.created++;
        return { id: 'pl1', url: 'https://example.com/pl1' };
      }),
    searchTrack:
      overrides.searchTrack ??
      (async (_api, t) => {
        calls.searched.push(t.title);
        return { status: 'found', externalId: `id-${t.title}`, matchedTitle: t.title, matchedArtist: t.artist, url: 'https://example.com/track', confidence: 1 };
      }),
    addTracks:
      overrides.addTracks ??
      (async (_api, _playlistId, externalIds) => {
        calls.added.push(externalIds);
        return { status: 'ok' };
      }),
  };

  return { connector, calls };
}

const noop = () => {};
const noopApiRequest = async () => ({});

describe('ImporterProgress', () => {
  it('creates the playlist once, searches every track, and batches adds at connector.batchSize', async () => {
    const { connector, calls } = makeConnector({ batchSize: 2 });
    const onImportComplete = vi.fn();

    render(
      <ImporterProgress
        tracks={[track('A - 1', 'A', '1'), track('A - 2', 'A', '2'), track('A - 3', 'A', '3')]}
        playlistName="My Playlist"
        playlistDesc="desc"
        isPublic={false}
        apiRequest={noopApiRequest}
        connector={connector}
        onRestart={noop}
        onBackToList={noop}
        historyId="hist-happy-path"
        onSaveProgress={noop}
        onImportComplete={onImportComplete}
      />
    );

    await waitFor(() => expect(screen.getByText('Playlist import completed successfully!')).toBeInTheDocument());

    expect(calls.created).toBe(1);
    expect(calls.searched.sort()).toEqual(['1', '2', '3']);
    // batchSize=2 with 3 tracks: one flush at 2, one final flush for the remaining 1.
    expect(calls.added).toHaveLength(2);
    expect(calls.added.flat().sort()).toEqual(['id-1', 'id-2', 'id-3']);
    expect(onImportComplete).toHaveBeenCalledWith('hist-happy-path', expect.objectContaining({ matched: 3, failed: 0, duplicates: 0, needsReview: 0, total: 3 }));
  });

  it('resumes from resumeFrom without recreating the playlist or re-processing done tracks', async () => {
    const { connector, calls } = makeConnector();
    const resumeFrom: ResumeData = {
      service: 'spotify',
      playlistId: 'existing-pl',
      playlistUrl: 'https://example.com/existing-pl',
      playlistDesc: 'desc',
      isPublic: false,
      tracks: [track('A - 1', 'A', '1'), track('A - 2', 'A', '2')],
      startIndex: 1,
      matchedTracks: [{ track: track('A - 1', 'A', '1'), matchedName: '1', matchedArtist: 'A', externalId: 'id-1', url: 'x', success: true }],
      failedTracks: [],
      pendingUris: [],
    };

    render(
      <ImporterProgress
        tracks={resumeFrom.tracks}
        playlistName="My Playlist"
        playlistDesc="desc"
        isPublic={false}
        apiRequest={noopApiRequest}
        connector={connector}
        onRestart={noop}
        onBackToList={noop}
        historyId="hist-resume"
        resumeFrom={resumeFrom}
        onSaveProgress={noop}
        onImportComplete={noop}
      />
    );

    await waitFor(() => expect(screen.getByText('Playlist import completed successfully!')).toBeInTheDocument());

    expect(calls.created).toBe(0); // reused resumeFrom.playlistId instead
    expect(calls.searched).toEqual(['2']); // track 1 was already done
    expect(screen.getByText('Matched (2)')).toBeInTheDocument();
  });

  it('skips adding a duplicate when two lines resolve to the same externalId', async () => {
    const { connector, calls } = makeConnector({
      searchTrack: async () => ({
        status: 'found',
        externalId: 'same-id',
        matchedTitle: 'Same Song',
        matchedArtist: 'Artist',
        url: 'https://example.com/track',
        confidence: 1,
      }),
    });

    render(
      <ImporterProgress
        tracks={[track('Artist - Same Song', 'Artist', 'Same Song'), track('The Artist - Same Song', 'The Artist', 'Same Song')]}
        playlistName="My Playlist"
        playlistDesc="desc"
        isPublic={false}
        apiRequest={noopApiRequest}
        connector={connector}
        onRestart={noop}
        onBackToList={noop}
        historyId="hist-duplicate"
        onSaveProgress={noop}
        onImportComplete={noop}
      />
    );

    await waitFor(() => expect(screen.getByText('Playlist import completed successfully!')).toBeInTheDocument());

    expect(screen.getByText('Matched (1)')).toBeInTheDocument();
    expect(screen.getByText('Duplicates Skipped (1)')).toBeInTheDocument();
    expect(calls.added.flat()).toEqual(['same-id']); // only added once, not twice
  });

  it('lets the user resolve a needs_review track by picking a candidate', async () => {
    const { connector, calls } = makeConnector({
      searchTrack: async () => ({
        status: 'needs_review',
        candidates: [
          { externalId: 'cand-1', title: 'Some Song', artist: 'Cover Band', url: 'https://example.com/1', confidence: 0.7 },
          { externalId: 'cand-2', title: 'Some Song', artist: 'Another Band', url: 'https://example.com/2', confidence: 0.6 },
        ],
      }),
    });

    render(
      <ImporterProgress
        tracks={[track('Original Artist - Some Song', 'Original Artist', 'Some Song')]}
        playlistName="My Playlist"
        playlistDesc="desc"
        isPublic={false}
        apiRequest={noopApiRequest}
        connector={connector}
        onRestart={noop}
        onBackToList={noop}
        historyId="hist-review"
        onSaveProgress={noop}
        onImportComplete={noop}
      />
    );

    await waitFor(() => expect(screen.getByText('Needs Review (1)')).toBeInTheDocument());

    const user = (await import('@testing-library/user-event')).default.setup();
    const candidateButton = screen.getByText(/Cover Band - Some Song/);
    await user.click(candidateButton);

    await waitFor(() => expect(screen.getByText('Matched (1)')).toBeInTheDocument());
    expect(screen.getByText('Needs Review (0)')).toBeInTheDocument();
    expect(calls.added.flat()).toEqual(['cand-1']);
  });

  it('stops immediately on quota_exceeded and saves resumable progress instead of completing', async () => {
    const { connector } = makeConnector({
      searchTrack: async () => ({ status: 'quota_exceeded' }),
    });
    const onSaveProgress = vi.fn();
    const onImportComplete = vi.fn();

    render(
      <ImporterProgress
        tracks={[track('A - 1', 'A', '1')]}
        playlistName="My Playlist"
        playlistDesc="desc"
        isPublic={false}
        apiRequest={noopApiRequest}
        connector={connector}
        onRestart={noop}
        onBackToList={noop}
        historyId="hist-quota"
        onSaveProgress={onSaveProgress}
        onImportComplete={onImportComplete}
      />
    );

    await waitFor(() => expect(screen.getByText(/daily API quota ran out/)).toBeInTheDocument());

    expect(onImportComplete).not.toHaveBeenCalled();
    expect(onSaveProgress).toHaveBeenCalled();
  });

  it('waits out a transient rate limit and completes once the connector recovers', async () => {
    let searchAttempts = 0;
    const { connector, calls } = makeConnector({
      searchTrack: async (_api, t) => {
        searchAttempts++;
        if (searchAttempts === 1) {
          return { status: 'rate_limited', waitSeconds: 1 };
        }
        return { status: 'found', externalId: 'id-1', matchedTitle: t.title, matchedArtist: t.artist, url: 'x', confidence: 1 };
      },
    });

    render(
      <ImporterProgress
        tracks={[track('A - 1', 'A', '1')]}
        playlistName="My Playlist"
        playlistDesc="desc"
        isPublic={false}
        apiRequest={noopApiRequest}
        connector={connector}
        onRestart={noop}
        onBackToList={noop}
        historyId="hist-ratelimit"
        onSaveProgress={noop}
        onImportComplete={noop}
      />
    );

    await waitFor(() => expect(screen.getByText('Playlist import completed successfully!')).toBeInTheDocument(), { timeout: 5000 });

    expect(screen.getByText('Matched (1)')).toBeInTheDocument();
    expect(calls.added.flat()).toEqual(['id-1']);
  });

  it('retries every failed track at once via Retry All, without needing individual clicks', async () => {
    const searchCounts: Record<string, number> = {};
    const { connector, calls } = makeConnector({
      searchTrack: async (_api, t) => {
        searchCounts[t.title] = (searchCounts[t.title] ?? 0) + 1;
        calls.searched.push(t.title);
        // Fails on the initial import pass, then succeeds once retried.
        if (searchCounts[t.title] === 1) {
          return { status: 'not_found' };
        }
        return { status: 'found', externalId: `id-${t.title}`, matchedTitle: t.title, matchedArtist: t.artist, url: 'x', confidence: 1 };
      },
    });

    render(
      <ImporterProgress
        tracks={[track('A - 1', 'A', '1'), track('A - 2', 'A', '2')]}
        playlistName="My Playlist"
        playlistDesc="desc"
        isPublic={false}
        apiRequest={noopApiRequest}
        connector={connector}
        onRestart={noop}
        onBackToList={noop}
        historyId="hist-retry-all"
        onSaveProgress={noop}
        onImportComplete={noop}
      />
    );

    await waitFor(() => expect(screen.getByText('Not Found (2)')).toBeInTheDocument());

    const user = (await import('@testing-library/user-event')).default.setup();
    await user.click(screen.getByText('🔁 Retry All (2)'));

    await waitFor(() => expect(screen.getByText('Matched (2)')).toBeInTheDocument());
    expect(screen.getByText('Not Found (0)')).toBeInTheDocument();
    expect(calls.added.flat().sort()).toEqual(['id-1', 'id-2']);
  });

  it('persists an accurate resumable checkpoint when addTracks throws mid-import (e.g. the destination playlist hit its max size)', async () => {
    const { connector } = makeConnector({
      addTracks: async () => {
        throw new Error('Spotify API error [403]: playlist reached its maximum size');
      },
    });
    const onSaveProgress = vi.fn();

    render(
      <ImporterProgress
        tracks={[track('A - 1', 'A', '1'), track('A - 2', 'A', '2')]}
        playlistName="My Playlist"
        playlistDesc="desc"
        isPublic={false}
        apiRequest={noopApiRequest}
        connector={connector}
        onRestart={noop}
        onBackToList={noop}
        historyId="hist-crash-mid-flush"
        onSaveProgress={onSaveProgress}
        onImportComplete={noop}
      />
    );

    await waitFor(() => expect(screen.getByText(/Critical Error/)).toBeInTheDocument());

    expect(onSaveProgress).toHaveBeenCalled();
    const [, , resumeData] = onSaveProgress.mock.calls[onSaveProgress.mock.calls.length - 1];
    // Both tracks were found by search before the add failed — the checkpoint must still
    // carry them as pending so they get retried on resume, not silently dropped.
    expect(resumeData.matchedTracks).toHaveLength(2);
    expect(resumeData.pendingUris.sort()).toEqual(['id-1', 'id-2']);
    expect(resumeData.playlistId).toBe('pl1');
  });
});
