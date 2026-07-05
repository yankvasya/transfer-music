import React, { useState } from 'react';

interface ClientIdSetupProps {
  currentClientId: string;
  onSave: (clientId: string) => void;
  redirectUri: string;
}

export const ClientIdSetup: React.FC<ClientIdSetupProps> = ({
  currentClientId,
  onSave,
  redirectUri,
}) => {
  const [clientId, setClientId] = useState(currentClientId);
  const [showConfig, setShowConfig] = useState(!currentClientId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (clientId.trim()) {
      onSave(clientId.trim());
      setShowConfig(false);
    }
  };

  if (!showConfig) {
    return (
      <div className="client-id-info glass-panel">
        <div className="info-row">
          <span>
            <strong>Spotify Client ID:</strong> <code>{currentClientId.slice(0, 6)}...{currentClientId.slice(-6)}</code>
          </span>
          <button className="btn btn-sm btn-outline" onClick={() => setShowConfig(true)}>
            Edit Config
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="client-id-setup glass-panel">
      <h3>🔑 Spotify Developer Credentials</h3>
      <p className="description-text">
        To use client-side authentication, you need to create a Spotify Developer App and get a Client ID.
      </p>

      <form onSubmit={handleSubmit} className="setup-form">
        <div className="form-group">
          <label htmlFor="clientIdInput">Spotify Client ID</label>
          <input
            id="clientIdInput"
            type="text"
            className="form-control"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Paste your Spotify Client ID here"
            required
          />
        </div>

        <div className="redirect-uri-display">
          <p className="description-text">
            <strong>Important:</strong> You must add this Redirect URI in your Spotify App settings:
          </p>
          <div className="copy-box">
            <code>{redirectUri}</code>
            <button
              type="button"
              className="btn btn-sm btn-outline-success"
              onClick={() => {
                navigator.clipboard.writeText(redirectUri);
                alert('Copied to clipboard!');
              }}
            >
              Copy
            </button>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            Save Credentials
          </button>
          {currentClientId && (
            <button type="button" className="btn btn-secondary" onClick={() => setShowConfig(false)}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
