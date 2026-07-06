import React from 'react';

interface SourceDestinationSelectProps {
  onContinue: () => void;
}

export const SourceDestinationSelect: React.FC<SourceDestinationSelectProps> = ({ onContinue }) => {
  return (
    <div className="glass-panel">
      <h2>🔀 Choose Import & Export</h2>
      <p className="description-text">
        Pick where your tracklist is coming from and where it should go. More services (VK, Yandex Music, etc.)
        are planned — for now only this pair is available.
      </p>

      <div className="form-group">
        <label htmlFor="sourceSelect">From</label>
        <select id="sourceSelect" className="form-control" value="plain-text" disabled>
          <option value="plain-text">📋 Plain Text List</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="destinationSelect">To</label>
        <select id="destinationSelect" className="form-control" value="spotify" disabled>
          <option value="spotify">🎧 Spotify</option>
        </select>
      </div>

      <div className="form-actions right-align">
        <button className="btn btn-primary btn-lg" onClick={onContinue}>
          Continue →
        </button>
      </div>
    </div>
  );
};
