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
});
