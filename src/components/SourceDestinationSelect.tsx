import React, { useState } from 'react';
import { ServiceIcon } from './ServiceIcon';

export type ConnectorId = 'plain-text' | 'spotify' | 'youtube' | 'yandex-music' | 'deezer';

interface ConnectorOption {
  id: ConnectorId;
  icon: React.ReactNode;
  label: string;
}

const CONNECTORS: ConnectorOption[] = [
  { id: 'plain-text', icon: '📋', label: 'Plain Text' },
  { id: 'spotify', icon: <ServiceIcon service="spotify" size={28} />, label: 'Spotify' },
  { id: 'youtube', icon: <ServiceIcon service="youtube" size={28} />, label: 'YouTube' },
  { id: 'yandex-music', icon: <ServiceIcon service="yandex-music" size={28} />, label: 'Yandex Music' },
  { id: 'deezer', icon: <ServiceIcon service="deezer" size={28} />, label: 'Deezer' },
];

// Any two distinct connectors can pair — a service can go through Plain Text, or
// straight into another service via the direct bridge (see BridgeRoute).
const isPairSupported = (from: ConnectorId, to: ConnectorId): boolean => from !== to;

interface SourceDestinationSelectProps {
  onContinue: (from: ConnectorId, to: ConnectorId) => void;
}

export const SourceDestinationSelect: React.FC<SourceDestinationSelectProps> = ({ onContinue }) => {
  const [from, setFrom] = useState<ConnectorId>('plain-text');
  const [to, setTo] = useState<ConnectorId>('spotify');

  const handleSelectFrom = (id: ConnectorId) => {
    setFrom(id);
    if (!isPairSupported(id, to)) {
      const fallback = CONNECTORS.find((c) => isPairSupported(id, c.id));
      if (fallback) setTo(fallback.id);
    }
  };

  const handleSelectTo = (id: ConnectorId) => {
    setTo(id);
    if (!isPairSupported(from, id)) {
      const fallback = CONNECTORS.find((c) => isPairSupported(c.id, id));
      if (fallback) setFrom(fallback.id);
    }
  };

  return (
    <div className="glass-panel">
      <h2>🔀 Choose Import & Export</h2>
      <p className="description-text">
        Pick where your tracklist is coming from and where it should go — straight from one service into another,
        or through Plain Text if you just want a tracklist to paste somewhere.
      </p>

      <div className="connector-picker">
        <div className="connector-column">
          <h4 id="connector-from-label">From</h4>
          <div className="connector-grid" role="radiogroup" aria-labelledby="connector-from-label">
            {CONNECTORS.map((connector) => (
              <button
                key={connector.id}
                type="button"
                role="radio"
                aria-checked={from === connector.id}
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
          <h4 id="connector-to-label">To</h4>
          <div className="connector-grid" role="radiogroup" aria-labelledby="connector-to-label">
            {CONNECTORS.map((connector) => (
              <button
                key={connector.id}
                type="button"
                role="radio"
                aria-checked={to === connector.id}
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
