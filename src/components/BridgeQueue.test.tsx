import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BridgeQueue } from './BridgeQueue';
import type { DestinationConnector, SourceConnector } from '../connectors/types';

const PLAYLIST_CONTENT: Record<string, { name: string; lines: string[] }> = {
  p1: { name: 'Playlist A', lines: ['Artist A - Song A1', 'Artist A - Song A2'] },
  p2: { name: 'Playlist B', lines: ['Artist B - Song B1'] },
};

function makeSource(): SourceConnector {
  return {
    id: 'spotify',
    label: 'Spotify',
    async listPlaylists() {
      return [];
    },
    async getPlaylistName(_apiRequest, playlistId) {
      return PLAYLIST_CONTENT[playlistId].name;
    },
    async getPlaylistTrackLines(_apiRequest, playlistId) {
      return PLAYLIST_CONTENT[playlistId].lines;
    },
  };
}

function makeDestination(createdPlaylists: { name: string }[]): DestinationConnector {
  return {
    id: 'deezer',
    label: 'Deezer',
    batchSize: 25,
    async createPlaylist(_apiRequest, name) {
      createdPlaylists.push({ name });
      return { id: `dest-${createdPlaylists.length}`, url: `https://example.com/playlist/${createdPlaylists.length}` };
    },
    async searchTrack(_apiRequest, track) {
      return {
        status: 'found',
        externalId: `id-${track.title}`,
        matchedTitle: track.title,
        matchedArtist: track.artist,
        confidence: 1,
        url: 'https://example.com/track',
      };
    },
    async addTracks() {
      return { status: 'ok' };
    },
  };
}

// Regression test for a real bug fixed while building this feature: a component that
// derived a fresh historyId from `index` while separately (async) fetching the matching
// name/tracks could briefly pair the NEW historyId with the PREVIOUS item's stale
// name/tracks, mounting a duplicate, misnamed destination playlist. This asserts the
// actual invariant that broke: exactly one createPlaylist call per queued item, each
// with the correct name, in order.
describe('BridgeQueue', () => {
  it('creates exactly one destination playlist per queued item, with the correct name', async () => {
    const createdPlaylists: { name: string }[] = [];

    render(
      <MemoryRouter>
        <BridgeQueue
          to="deezer"
          playlistIds={['p1', 'p2']}
          source={makeSource()}
          destination={makeDestination(createdPlaylists)}
          sourceApiRequest={vi.fn()}
          destApiRequest={vi.fn()}
          onSaveProgress={vi.fn()}
          onImportComplete={vi.fn()}
        />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText(/Queue Complete/)).toBeInTheDocument(), { timeout: 8000 });

    expect(createdPlaylists).toEqual([{ name: 'Playlist A' }, { name: 'Playlist B' }]);
  });

  // A connector-wide quota/rate-limit exhaustion on one item will almost certainly hit
  // the next item immediately too, so the queue must pause and let the user decide
  // rather than silently burning through the rest of the queue.
  it('pauses instead of auto-advancing when a playlist stops due to connector quota exhaustion', async () => {
    const createdPlaylists: { name: string }[] = [];
    const destination = makeDestination(createdPlaylists);
    const exhaustedDestination: DestinationConnector = {
      ...destination,
      async searchTrack() {
        return { status: 'quota_exceeded' };
      },
    };

    render(
      <MemoryRouter>
        <BridgeQueue
          to="deezer"
          playlistIds={['p1', 'p2']}
          source={makeSource()}
          destination={exhaustedDestination}
          sourceApiRequest={vi.fn()}
          destApiRequest={vi.fn()}
          onSaveProgress={vi.fn()}
          onImportComplete={vi.fn()}
        />
      </MemoryRouter>
    );

    // onDone (which flips connectorExhausted) fires 1.5s after ImporterProgress reaches
    // its terminal status, so this needs a longer timeout than the default 1000ms.
    await waitFor(() => expect(screen.getByText(/stopped early/)).toBeInTheDocument(), { timeout: 3000 });

    // Only the first playlist's destination playlist was created — the queue paused
    // rather than silently moving on to the second, which would hit the same quota wall.
    expect(createdPlaylists).toEqual([{ name: 'Playlist A' }]);
    expect(screen.getByText('← Stop Queue')).toBeInTheDocument();
    expect(screen.getByText('Skip to Next Playlist →')).toBeInTheDocument();
  });
});
