import React, { useState, useEffect } from 'react';
import type { ApiRequest, PlaylistSummary, SourceConnector } from '../connectors/types';

export interface PlaylistSetupOptions {
  mode: 'create' | 'existing';
  name: string;
  description: string;
  isPublic: boolean;
  existingPlaylistId?: string;
  existingPlaylistUrl?: string;
}

interface PlaylistSetupProps {
  trackCount: number;
  apiRequest: ApiRequest;
  source: SourceConnector;
  currentUserId: string | null;
  onBack: () => void;
  onStart: (options: PlaylistSetupOptions) => void;
}

export const PlaylistSetup: React.FC<PlaylistSetupProps> = ({
  trackCount,
  apiRequest,
  source,
  currentUserId,
  onBack,
  onStart,
}) => {
  const defaultName = `Imported Playlist (${new Date().toLocaleDateString()})`;
  const [mode, setMode] = useState<'create' | 'existing'>('create');
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('Imported via TransferMusic (github.com/yankvasya/transfer-music)');
  const [isPublic, setIsPublic] = useState(false);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [existingPlaylistId, setExistingPlaylistId] = useState<string>('');

  // Load the user's playlists once. Used for two things: the best-effort duplicate-name
  // warning in "create" mode, and the picker in "use existing playlist" mode. These
  // services allow duplicate names, so the warning never blocks — it only informs.
  useEffect(() => {
    let active = true;

    const loadPlaylists = async () => {
      try {
        const list = await source.listPlaylists(apiRequest, currentUserId);
        if (!active) return;
        setPlaylists(list);
        const firstOwn = list.find((p) => p.exportable);
        setExistingPlaylistId(firstOwn?.id ?? '');
      } catch {
        // Non-critical — just skip the warning/picker if this fails.
        if (active) setLoadFailed(true);
      }
    };

    loadPlaylists();
    return () => {
      active = false;
    };
  }, [apiRequest, source, currentUserId]);

  const existingNames = new Set(playlists.map((p) => p.name.toLowerCase()));
  const isDuplicateName = existingNames.has(name.trim().toLowerCase());
  // Only playlists the app can actually write to (own playlists) can receive an import.
  const ownPlaylists = playlists.filter((p) => p.exportable);
  const selectedPlaylist = ownPlaylists.find((p) => p.id === existingPlaylistId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'existing') {
      if (!selectedPlaylist) return;
      onStart({
        mode,
        name: selectedPlaylist.name,
        description: '',
        isPublic: false,
        existingPlaylistId: selectedPlaylist.id,
        existingPlaylistUrl: selectedPlaylist.externalUrl,
      });
      return;
    }
    if (name.trim()) {
      onStart({ mode, name: name.trim(), description: description.trim(), isPublic });
    }
  };

  return (
    <div className="playlist-setup-panel glass-panel">
      <h2>🎵 Step 2: Configure {source.label} Playlist</h2>
      <p className="description-text">
        {mode === 'existing' ? (
          <>
            Import your <strong>{trackCount}</strong> tracks into a {source.label} playlist you already have.
          </>
        ) : (
          <>
            Prepare the settings for the new {source.label} playlist containing your <strong>{trackCount}</strong> tracks.
          </>
        )}
      </p>

      <form onSubmit={handleSubmit} className="setup-form">
        <div className="form-group">
          <span className="form-label">Import into</span>
          <div className="mode-toggle">
            <label className={`mode-option${mode === 'create' ? ' selected' : ''}`}>
              <input
                type="radio"
                name="playlistMode"
                value="create"
                checked={mode === 'create'}
                onChange={() => setMode('create')}
              />
              Create new playlist
            </label>
            <label className={`mode-option${mode === 'existing' ? ' selected' : ''}`}>
              <input
                type="radio"
                name="playlistMode"
                value="existing"
                checked={mode === 'existing'}
                onChange={() => setMode('existing')}
                disabled={ownPlaylists.length === 0}
              />
              Use existing playlist
            </label>
          </div>
          {mode === 'existing' && ownPlaylists.length === 0 && (
            <p className="duplicate-warning mt-2">
              {loadFailed
                ? `⚠ Couldn't load your ${source.label} playlists. Try creating a new playlist instead.`
                : `⚠ No ${source.label} playlists you own were found. Try creating a new playlist instead.`}
            </p>
          )}
        </div>

        {mode === 'create' ? (
          <>
            <div className="form-group">
              <label htmlFor="playlistName">Playlist Name</label>
              <input
                id="playlistName"
                type="text"
                className="form-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="E.g., My Favorite Songs"
                required
              />
              {isDuplicateName && (
                <p className="duplicate-warning mt-2">
                  ⚠ You already have a playlist named "{name.trim()}". {source.label} allows duplicate names, so a new,
                  separate playlist will be created — rename it above if that's not what you want.
                </p>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="playlistDesc">Description</label>
              <textarea
                id="playlistDesc"
                className="form-control"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A short description for your playlist"
              />
            </div>

            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                />
                Make Playlist Public (anyone can search and see it)
              </label>
            </div>
          </>
        ) : (
          <div className="form-group">
            <label htmlFor="existingPlaylist">Existing Playlist</label>
            {ownPlaylists.length > 0 ? (
              <select
                id="existingPlaylist"
                className="form-control"
                value={existingPlaylistId}
                onChange={(e) => setExistingPlaylistId(e.target.value)}
                required
              >
                {ownPlaylists.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.trackCount} tracks)
                  </option>
                ))}
              </select>
            ) : (
              <p className="duplicate-warning">
                No {source.label} playlists you own are available to import into.
              </p>
            )}
          </div>
        )}

        <div className="form-actions split">
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            ← Back to Tracklist
          </button>
          <button type="submit" className="btn btn-success btn-lg">
            {mode === 'existing' ? 'Add Tracks to Playlist 🚀' : 'Start Transfer 🚀'}
          </button>
        </div>
      </form>
    </div>
  );
};
