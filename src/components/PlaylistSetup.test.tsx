import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlaylistSetup } from './PlaylistSetup';
import type { SourceConnector } from '../connectors/types';

function makeSource(existingNames: string[] = []): SourceConnector {
  return {
    id: 'spotify',
    label: 'Spotify',
    async listPlaylists() {
      return existingNames.map((name, i) => ({
        id: `p${i}`,
        name,
        trackCount: 0,
        externalUrl: '',
        exportable: true,
      }));
    },
    async getPlaylistName() {
      return '';
    },
    async getPlaylistTrackLines() {
      return [];
    },
  };
}

describe('PlaylistSetup', () => {
  it('submits the trimmed name, description, and public flag on continue', async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();

    render(
      <PlaylistSetup trackCount={5} apiRequest={vi.fn()} source={makeSource()} currentUserId="me" onBack={vi.fn()} onStart={onStart} />
    );

    const nameInput = screen.getByLabelText('Playlist Name');
    await user.clear(nameInput);
    await user.type(nameInput, '  My Road Trip  ');
    await user.click(screen.getByLabelText(/Make Playlist Public/));
    await user.click(screen.getByText('Start Transfer 🚀'));

    expect(onStart).toHaveBeenCalledWith('My Road Trip', 'Imported via TransferMusic (github.com/yankvasya/transfer-music)', true);
  });

  it('warns, without blocking, when the chosen name matches an existing playlist', async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();

    render(
      <PlaylistSetup
        trackCount={5}
        apiRequest={vi.fn()}
        source={makeSource(['Road Trip'])}
        currentUserId="me"
        onBack={vi.fn()}
        onStart={onStart}
      />
    );

    const nameInput = screen.getByLabelText('Playlist Name');
    await user.clear(nameInput);
    await user.type(nameInput, 'road trip'); // case-insensitive match

    await waitFor(() => expect(screen.getByText(/You already have a playlist named/)).toBeInTheDocument());

    await user.click(screen.getByText('Start Transfer 🚀'));
    expect(onStart).toHaveBeenCalled(); // warning only, never blocks submission
  });
});
