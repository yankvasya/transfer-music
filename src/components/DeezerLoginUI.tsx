import React from 'react';
import { LoginButton } from './LoginButton';
import { ServiceIcon } from './ServiceIcon';

interface DeezerLoginUIProps {
  isConfigured: boolean;
  isLoading: boolean;
  login: () => void;
}

// Deezer has no PKCE option, so this uses a shared app (VITE_DEEZER_APP_ID +
// server-side DEEZER_APP_SECRET) instead of asking each visitor to register their own —
// just a plain "Login with Deezer" button, same shape as Yandex's device-flow entry point.
export const DeezerLoginUI: React.FC<DeezerLoginUIProps> = ({ isConfigured, isLoading, login }) => {
  if (!isConfigured) {
    return (
      <div className="glass-panel center-align">
        <h2>❌ Deezer isn't configured on this deployment</h2>
        <p className="description-text">
          This deployment is missing its Deezer app credentials (VITE_DEEZER_APP_ID and the server-side
          DEEZER_APP_ID/DEEZER_APP_SECRET). If this is your own deployment, register an app at{' '}
          <code>developers.deezer.com/myapps</code> and set those environment variables.
        </p>
      </div>
    );
  }

  return (
    <LoginButton
      onLogin={login}
      isLoading={isLoading}
      serviceName="Deezer"
      icon={<ServiceIcon service="deezer" size={32} />}
      description="Log in with your Deezer account to authorize creating playlists and importing your tracks."
      buttonClassName="btn-deezer"
      securityNote="Your access token is stored only in your own browser."
    />
  );
};
