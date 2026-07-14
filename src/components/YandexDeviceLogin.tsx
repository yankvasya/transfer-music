import React from 'react';
import type { YandexDeviceCode } from '../hooks/useYandexMusic';
import { ServiceIcon } from './ServiceIcon';

interface YandexDeviceLoginProps {
  deviceCode: YandexDeviceCode | null;
  authStatus: 'idle' | 'waiting' | 'error';
  authError: string | null;
  onStart: () => void;
  onCancel: () => void;
}

// Yandex Music has no per-developer Client ID / redirect URI to configure — login is
// the OAuth Device Flow: request a code, show it with a link to Yandex's confirmation
// page, then poll in the background until the user approves it there.
export const YandexDeviceLogin: React.FC<YandexDeviceLoginProps> = ({ deviceCode, authStatus, authError, onStart, onCancel }) => {
  if (deviceCode) {
    return (
      <div className="login-panel glass-panel center-align">
        <div className="login-icon-large">
          <ServiceIcon service="yandex-music" size={32} />
        </div>
        <h2>Confirm on Yandex</h2>
        <p className="description-text">Open the link below and enter this code to finish connecting your account.</p>

        <div className="redirect-uri-display" style={{ width: '100%' }}>
          <div className="copy-box" style={{ justifyContent: 'center' }}>
            <code style={{ fontSize: '1.4rem', letterSpacing: '0.15em', textAlign: 'center', flex: 'none' }}>
              {deviceCode.userCode}
            </code>
          </div>
        </div>

        <a href={deviceCode.verificationUrl} target="_blank" rel="noopener noreferrer" className="btn btn-yandex btn-lg">
          Open {new URL(deviceCode.verificationUrl).hostname} <span aria-hidden="true">&rarr;</span>
        </a>

        <p className="description-text" style={{ marginTop: '1.5rem' }}>
          <span className="spinner">Waiting for confirmation...</span>
        </p>

        <button className="btn btn-sm btn-outline" onClick={onCancel} style={{ marginTop: '1rem' }}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="login-panel glass-panel center-align">
      <div className="login-icon-large">
        <ServiceIcon service="yandex-music" size={32} />
      </div>
      <h2>Connect to Yandex Music</h2>
      <p className="description-text">
        Log in with your Yandex account to authorize creating playlists and importing your tracks.
      </p>

      {authStatus === 'error' && authError && <p className="description-text badge badge-danger">{authError}</p>}

      <button className="btn btn-yandex btn-lg" onClick={onStart} disabled={authStatus === 'waiting'}>
        {authStatus === 'waiting' ? (
          <span className="spinner">Requesting code...</span>
        ) : (
          <>
            <span className="spotify-logo-small">
              <ServiceIcon service="yandex-music" size={18} />
            </span>{' '}
            Login with Yandex Music
          </>
        )}
      </button>

      <p className="security-note">
        Note: Yandex doesn't let third-party apps register their own credentials, so this app's own OAuth app is used
        to request a login code on your behalf. Your access token is stored only in your own browser.
      </p>
    </div>
  );
};
