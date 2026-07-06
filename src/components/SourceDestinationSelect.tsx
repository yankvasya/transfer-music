import React from 'react';

interface ConnectorOption {
  id: string;
  icon: string;
  label: string;
}

const SOURCES: ConnectorOption[] = [{ id: 'plain-text', icon: '📋', label: 'Plain Text' }];
const DESTINATIONS: ConnectorOption[] = [{ id: 'spotify', icon: '🎧', label: 'Spotify' }];

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

      <div className="connector-picker">
        <div className="connector-column">
          <h4>From</h4>
          <div className="connector-grid">
            {SOURCES.map((source) => (
              <div key={source.id} className="connector-tile active">
                <span className="connector-tile-icon">{source.icon}</span>
                <span className="connector-tile-label">{source.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="connector-arrow">→</div>

        <div className="connector-column">
          <h4>To</h4>
          <div className="connector-grid">
            {DESTINATIONS.map((destination) => (
              <div key={destination.id} className="connector-tile active">
                <span className="connector-tile-icon">{destination.icon}</span>
                <span className="connector-tile-label">{destination.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="form-actions right-align">
        <button className="btn btn-primary btn-lg" onClick={onContinue}>
          Continue →
        </button>
      </div>
    </div>
  );
};
