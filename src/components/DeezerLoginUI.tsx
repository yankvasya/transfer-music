import React, { useState } from 'react';
import { LoginButton } from './LoginButton';

interface DeezerLoginUIProps {
  appId: string;
  setAppId: (id: string) => void;
  appSecret: string;
  setAppSecret: (secret: string) => void;
  isLoading: boolean;
  login: () => void;
  redirectUri: string;
}

// Deezer needs both an App ID and a Secret Key (no PKCE option, and no shared/public
// credential like Yandex has), so this is its own two-field variant of ClientIdSetup
// rather than reusing OAuthLoginUI/ClientIdSetup, which only handle a single Client ID.
export const DeezerLoginUI: React.FC<DeezerLoginUIProps> = ({
  appId,
  setAppId,
  appSecret,
  setAppSecret,
  isLoading,
  login,
  redirectUri,
}) => {
  const [idInput, setIdInput] = useState(appId);
  const [secretInput, setSecretInput] = useState(appSecret);
  const [showConfig, setShowConfig] = useState(!appId || !appSecret);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (idInput.trim() && secretInput.trim()) {
      setAppId(idInput.trim());
      setAppSecret(secretInput.trim());
      setShowConfig(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {showConfig ? (
        <div className="client-id-setup glass-panel">
          <h3>🔑 Deezer Developer Credentials</h3>
          <p className="description-text">
            To use client-side authentication, create an app at{' '}
            <code>developers.deezer.com/myapps</code> and get its App ID and Secret Key. Both are stored only in
            your own browser and sent only to this app's own server, which forwards them to Deezer and never keeps
            them.
          </p>

          <form onSubmit={handleSubmit} className="setup-form">
            <div className="form-group">
              <label htmlFor="deezerAppId">Deezer App ID</label>
              <input
                id="deezerAppId"
                type="text"
                className="form-control"
                value={idInput}
                onChange={(e) => setIdInput(e.target.value)}
                placeholder="Paste your Deezer App ID here"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="deezerAppSecret">Deezer Secret Key</label>
              <input
                id="deezerAppSecret"
                type="password"
                className="form-control"
                value={secretInput}
                onChange={(e) => setSecretInput(e.target.value)}
                placeholder="Paste your Deezer Secret Key here"
                required
              />
            </div>

            <div className="redirect-uri-display">
              <p className="description-text">
                <strong>Important:</strong> You must add this Redirect URI in your Deezer App settings:
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
              {appId && appSecret && (
                <button type="button" className="btn btn-secondary" onClick={() => setShowConfig(false)}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      ) : (
        <div className="client-id-info glass-panel">
          <div className="info-row">
            <span>
              <strong>Deezer App ID:</strong> <code>{appId}</code>
            </span>
            <button className="btn btn-sm btn-outline" onClick={() => setShowConfig(true)}>
              Edit Config
            </button>
          </div>
        </div>
      )}

      {appId && appSecret && (
        <LoginButton
          onLogin={login}
          isLoading={isLoading}
          serviceName="Deezer"
          icon="🎶"
          description="Log in with your Deezer account to authorize creating playlists and importing your tracks."
          buttonClassName="btn-deezer"
          securityNote="Note: Deezer has no PKCE option, so this app's own server briefly relays the token exchange using the Secret Key you provided — it is never stored server-side. Your access token is stored only in your own browser."
        />
      )}
    </div>
  );
};
