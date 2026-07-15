import React, { useState, useEffect } from 'react';
import type { ApiRequest, SourceConnector } from '../connectors/types';

interface PlaylistSetupProps {
  trackCount: number;
  apiRequest: ApiRequest;
  source: SourceConnector;
  currentUserId: string | null;
  onBack: () => void;
  onStart: (name: string, description: string, isPublic: boolean) => void;
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
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('Imported via TransferMusic (github.com/yankvasya/transfer-music)');
  const [isPublic, setIsPublic] = useState(false);
  const [existingNames, setExistingNames] = useState<Set<string>>(new Set());

  // Best-effort check for existing playlist names, so users can spot accidental duplicates.
  // These services allow duplicate names, so this only ever warns, never blocks.
  useEffect(() => {
    let active = true;

    const loadExistingNames = async () => {
      try {
        const playlists = await source.listPlaylists(apiRequest, currentUserId);
        if (active) setExistingNames(new Set(playlists.map((p) => p.name.toLowerCase())));
      } catch {
        // Non-critical — just skip the warning if this fails.
      }
    };

    loadExistingNames();
    return () => {
      active = false;
    };
  }, [apiRequest, source, currentUserId]);

  const isDuplicateName = existingNames.has(name.trim().toLowerCase());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onStart(name.trim(), description.trim(), isPublic);
    }
  };

  return (
    <div className="playlist-setup-panel glass-panel">
      <h2>🎵 Step 2: Configure {source.label} Playlist</h2>
      <p className="description-text">
        Prepare the settings for the new {source.label} playlist containing your <strong>{trackCount}</strong> tracks.
      </p>

      <form onSubmit={handleSubmit} className="setup-form">
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

        <div className="form-actions split">
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            ← Back to Tracklist
          </button>
          <button type="submit" className="btn btn-success btn-lg">
            Start Transfer 🚀
          </button>
        </div>
      </form>
    </div>
  );
};
