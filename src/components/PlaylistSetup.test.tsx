import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlaylistSetup } from './PlaylistSetup';
import type { SourceConnector } from '../connectors/types';

type FakePlaylist = string | { name: string; trackCount?: number; exportable?: boolean };

function makeSource(existing: FakePlaylist[] = []): SourceConnector {
  return {
    id: 'spotify',
    label: 'Spotify',
    async listPlaylists() {
      return existing.map((p, i) => {
        const item = typeof p === 'string' ? { name: p } : p;
        return {
          id: `p${i}`,
          name: item.name,
          trackCount: item.trackCount ?? 0,
          externalUrl: `https://open.spotify.com/playlist/p${i}`,
          exportable: item.exportable ?? true,
        };
      });
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
  it('submits the trimmed name, description, and public flag on continue (create mode)', async () => {
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

    expect(onStart).toHaveBeenCalledWith({
      mode: 'create',
      name: 'My Road Trip',
      description: 'Imported via TransferMusic (github.com/yankvasya/transfer-music)',
      isPublic: true,
    });
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

  it('submits an existing playlist selection without requiring name/description', async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();

    render(
      <PlaylistSetup
        trackCount={5}
        apiRequest={vi.fn()}
        source={makeSource(['Road Trip', { name: 'My Night Mix', trackCount: 42 }])}
        currentUserId="me"
        onBack={vi.fn()}
        onStart={onStart}
      />
    );

    await user.click(screen.getByLabelText('Use existing playlist'));

    // Name/description inputs should not be shown in existing mode.
    expect(screen.queryByLabelText('Playlist Name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Description')).not.toBeInTheDocument();

    const select = screen.getByLabelText('Existing Playlist') as HTMLSelectElement;
    await user.selectOptions(select, 'p1');

    await user.click(screen.getByText('Add Tracks to Playlist 🚀'));

    expect(onStart).toHaveBeenCalledWith({
      mode: 'existing',
      name: 'My Night Mix',
      description: '',
      isPublic: false,
      existingPlaylistId: 'p1',
      existingPlaylistUrl: 'https://open.spotify.com/playlist/p1',
    });
  });

  it('disables the existing option when there are no owned playlists', async () => {
    const onStart = vi.fn();

    render(
      <PlaylistSetup
        trackCount={5}
        apiRequest={vi.fn()}
        source={makeSource([{ name: 'Someone elses mix', exportable: false }])}
        currentUserId="me"
        onBack={vi.fn()}
        onStart={onStart}
      />
    );

    const existingRadio = screen.getByLabelText('Use existing playlist') as HTMLInputElement;
    expect(existingRadio).toBeDisabled();
  });
});
