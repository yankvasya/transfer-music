import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ExportView } from './ExportView';
import type { SourceConnector } from '../connectors/types';

function makeSource(): SourceConnector {
  return {
    id: 'spotify',
    label: 'Spotify',
    async listPlaylists() {
      return [{ id: 'p1', name: 'Road Trip', trackCount: 2, externalUrl: '', exportable: true }];
    },
    async getPlaylistName() {
      return 'Road Trip';
    },
    async getPlaylistTrackLines() {
      return ['Artist A - Song A', 'Artist B - Song B'];
    },
  };
}

describe('ExportView', () => {
  it('lists playlists to pick from when none is selected in the URL', async () => {
    render(
      <MemoryRouter initialEntries={['/export']}>
        <ExportView source={makeSource()} apiRequest={vi.fn()} currentUserId="me" />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Road Trip')).toBeInTheDocument());
    expect(screen.getByText('2 tracks')).toBeInTheDocument();
  });

  it('loads a playlist named in the URL and renders its tracks as plain text', async () => {
    render(
      <MemoryRouter initialEntries={['/export?type=spotify&playlist_id=p1']}>
        <ExportView source={makeSource()} apiRequest={vi.fn()} currentUserId="me" />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('2 tracks, ready to copy or download.')).toBeInTheDocument());
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Artist A - Song A\nArtist B - Song B');
  });

  it('copies the tracklist to the clipboard', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/export?type=spotify&playlist_id=p1']}>
        <ExportView source={makeSource()} apiRequest={vi.fn()} currentUserId="me" />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('📋 Copy to Clipboard')).toBeInTheDocument());
    await user.click(screen.getByText('📋 Copy to Clipboard'));

    await waitFor(() => expect(screen.getByText('✓ Copied!')).toBeInTheDocument());
  });

  it('falls back to select-for-manual-copy when the Clipboard API rejects', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));

    render(
      <MemoryRouter initialEntries={['/export?type=spotify&playlist_id=p1']}>
        <ExportView source={makeSource()} apiRequest={vi.fn()} currentUserId="me" />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('📋 Copy to Clipboard')).toBeInTheDocument());
    await user.click(screen.getByText('📋 Copy to Clipboard'));

    await waitFor(() => expect(screen.getByText('Selected — press Cmd/Ctrl+C')).toBeInTheDocument());
    vi.restoreAllMocks();
  });

  it('downloads a CSV with Artist/Title columns split from the tracklist', async () => {
    const user = userEvent.setup();
    let capturedBlob: Blob | null = null;
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      capturedBlob = blob as Blob;
      return 'blob:mock';
    });
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    render(
      <MemoryRouter initialEntries={['/export?type=spotify&playlist_id=p1']}>
        <ExportView source={makeSource()} apiRequest={vi.fn()} currentUserId="me" />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('⬇ Download .csv')).toBeInTheDocument());
    await user.click(screen.getByText('⬇ Download .csv'));

    expect(createObjectURL).toHaveBeenCalled();
    expect(capturedBlob!.type).toContain('text/csv');
    const text = await capturedBlob!.text();
    expect(text).toBe('Artist,Title\r\n"Artist A","Song A"\r\n"Artist B","Song B"');

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });

  it('shows an error screen when loading the playlist fails', async () => {
    const source: SourceConnector = {
      ...makeSource(),
      async getPlaylistName() {
        throw new Error('Playlist not found');
      },
    };

    render(
      <MemoryRouter initialEntries={['/export?type=spotify&playlist_id=p1']}>
        <ExportView source={source} apiRequest={vi.fn()} currentUserId="me" />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Playlist not found')).toBeInTheDocument());
  });
});
