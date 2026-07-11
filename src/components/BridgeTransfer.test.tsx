import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BridgeTransfer } from './BridgeTransfer';
import type { PlaylistSummary, SourceConnector } from '../connectors/types';

const PLAYLISTS: PlaylistSummary[] = [
  { id: 'p1', name: 'Playlist A', trackCount: 5, externalUrl: 'https://example.com/p1', exportable: true },
  { id: 'p2', name: 'Playlist B', trackCount: 3, externalUrl: 'https://example.com/p2', exportable: true },
  { id: 'p3', name: 'Playlist C', trackCount: 8, externalUrl: 'https://example.com/p3', exportable: true },
  { id: 'p4', name: 'Someone Else\'s Playlist', trackCount: 12, externalUrl: 'https://example.com/p4', exportable: false, unexportableReason: 'Not owned by you' },
];

function makeSource(): SourceConnector {
  return {
    id: 'spotify',
    label: 'Spotify',
    async listPlaylists() {
      return PLAYLISTS;
    },
    async getPlaylistName() {
      return '';
    },
    async getPlaylistTrackLines() {
      return [];
    },
  };
}

describe('BridgeTransfer', () => {
  it('lets the user select and deselect every exportable playlist at once, ignoring unexportable ones', async () => {
    render(
      <MemoryRouter>
        <BridgeTransfer from="spotify" to="deezer" source={makeSource()} sourceApiRequest={vi.fn()} sourceCurrentUserId="me" />
      </MemoryRouter>
    );

    const selectAll = await screen.findByText('Select All (3)');
    const user = userEvent.setup();
    await user.click(selectAll);

    await waitFor(() => expect(screen.getByText('Move 3 Playlists →')).toBeInTheDocument());
    expect(screen.getByText('Deselect All')).toBeInTheDocument();
    // The unexportable playlist was never selectable, so it can't be part of the count.
    expect(screen.queryByText('Select All (4)')).not.toBeInTheDocument();

    await user.click(screen.getByText('Deselect All'));

    await waitFor(() => expect(screen.getByText('Move Playlists →')).toBeInTheDocument());
    expect((screen.getByText('Move Playlists →') as HTMLButtonElement).disabled).toBe(true);
  });
});
