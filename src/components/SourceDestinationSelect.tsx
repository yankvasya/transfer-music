import React, { useState } from 'react';

export type ConnectorId = 'plain-text' | 'spotify';

interface ConnectorOption {
  id: ConnectorId;
  icon: string;
  label: string;
}

// Every connector can sit on either side today. As more services are added, some pairs
// may need explicit compatibility rules instead of "just not the same one twice".
const CONNECTORS: ConnectorOption[] = [
  { id: 'plain-text', icon: '📋', label: 'Plain Text' },
  { id: 'spotify', icon: '🎧', label: 'Spotify' },
];

interface SourceDestinationSelectProps {
  onContinue: (from: ConnectorId, to: ConnectorId) => void;
}

export const SourceDestinationSelect: React.FC<SourceDestinationSelectProps> = ({ onContinue }) => {
  const [from, setFrom] = useState<ConnectorId>('plain-text');
  const [to, setTo] = useState<ConnectorId>('spotify');

  const otherOf = (id: ConnectorId): ConnectorId => (id === 'plain-text' ? 'spotify' : 'plain-text');

  const handleSelectFrom = (id: ConnectorId) => {
    setFrom(id);
    if (to === id) setTo(otherOf(id));
  };

  const handleSelectTo = (id: ConnectorId) => {
    setTo(id);
    if (from === id) setFrom(otherOf(id));
  };

  return (
    <div className="glass-panel">
      <h2>🔀 Choose Import & Export</h2>
      <p className="description-text">
        Pick where your tracklist is coming from and where it should go. More services (VK, Yandex Music, etc.)
        are planned — for now only Plain Text and Spotify are available, in either direction.
      </p>

      <div className="connector-picker">
        <div className="connector-column">
          <h4>From</h4>
          <div className="connector-grid">
            {CONNECTORS.map((connector) => (
              <button
                key={connector.id}
                type="button"
                className={`connector-tile${from === connector.id ? ' active' : ''}`}
                onClick={() => handleSelectFrom(connector.id)}
              >
                <span className="connector-tile-icon">{connector.icon}</span>
                <span className="connector-tile-label">{connector.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="connector-arrow">→</div>

        <div className="connector-column">
          <h4>To</h4>
          <div className="connector-grid">
            {CONNECTORS.map((connector) => (
              <button
                key={connector.id}
                type="button"
                className={`connector-tile${to === connector.id ? ' active' : ''}`}
                onClick={() => handleSelectTo(connector.id)}
              >
                <span className="connector-tile-icon">{connector.icon}</span>
                <span className="connector-tile-label">{connector.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="form-actions right-align">
        <button className="btn btn-primary btn-lg" onClick={() => onContinue(from, to)}>
          Continue →
        </button>
      </div>
    </div>
  );
};
