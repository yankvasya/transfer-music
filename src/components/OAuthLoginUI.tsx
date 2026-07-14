import React from 'react';
import { LoginButton } from './LoginButton';
import { ServiceIcon } from './ServiceIcon';
import type { ServiceId } from '../types';

interface OAuthLoginUIProps {
  service: ServiceId;
  isConfigured: boolean;
  isLoading: boolean;
  login: () => void;
  serviceName: string;
  loginDescription: string;
  loginButtonClass: string;
}

// Login UI for services using the redirect-based OAuth PKCE flow (Spotify, YouTube):
// both use this app's own shared Client ID (a VITE_ env var) rather than asking each
// visitor to register their own app. Yandex uses a different flow entirely (see
// YandexDeviceLogin); Deezer has its own near-identical shared-app variant (see
// DeezerLoginUI) since it needs a server-side secret too, which this flow doesn't.
export const OAuthLoginUI: React.FC<OAuthLoginUIProps> = ({
  service,
  isConfigured,
  isLoading,
  login,
  serviceName,
  loginDescription,
  loginButtonClass,
}) => {
  if (!isConfigured) {
    return (
      <div className="glass-panel center-align">
        <h2>❌ {serviceName} isn't configured on this deployment</h2>
        <p className="description-text">This deployment is missing its {serviceName} Client ID environment variable.</p>
      </div>
    );
  }

  return (
    <LoginButton
      onLogin={login}
      isLoading={isLoading}
      serviceName={serviceName}
      icon={<ServiceIcon service={service} size={32} />}
      description={loginDescription}
      buttonClassName={loginButtonClass}
    />
  );
};
