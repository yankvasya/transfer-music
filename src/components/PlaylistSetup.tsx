import React, { useState } from 'react';

interface PlaylistSetupProps {
  trackCount: number;
  onBack: () => void;
  onStart: (name: string, description: string, isPublic: boolean) => void;
}

export const PlaylistSetup: React.FC<PlaylistSetupProps> = ({
  trackCount,
  onBack,
  onStart,
}) => {
  const defaultName = `Imported Playlist (${new Date().toLocaleDateString()})`;
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('Imported via TransferMusic');
  const [isPublic, setIsPublic] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onStart(name.trim(), description.trim(), isPublic);
    }
  };

  return (
    <div className="playlist-setup-panel glass-panel">
      <h2>🎵 Step 2: Configure Spotify Playlist</h2>
      <p className="description-text">
        Prepare the settings for the new Spotify playlist containing your <strong>{trackCount}</strong> tracks.
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
