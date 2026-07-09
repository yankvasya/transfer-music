import React from 'react';
import { ClientIdSetup } from './ClientIdSetup';
import { LoginButton } from './LoginButton';

interface OAuthLoginUIProps {
  clientId: string;
  setClientId: (id: string) => void;
  isLoading: boolean;
  login: () => void;
  serviceName: string;
  helpText: string;
  loginDescription: string;
  loginIcon: string;
  loginButtonClass: string;
  redirectUri: string;
}

// Login UI for services using the redirect-based OAuth PKCE flow (Spotify, YouTube):
// the user registers their own Client ID, then clicks through to the provider's
// consent screen. Yandex uses a different flow entirely (see YandexDeviceLogin).
export const OAuthLoginUI: React.FC<OAuthLoginUIProps> = ({
  clientId,
  setClientId,
  isLoading,
  login,
  serviceName,
  helpText,
  loginDescription,
  loginIcon,
  loginButtonClass,
  redirectUri,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
    <ClientIdSetup
      serviceName={serviceName}
      helpText={helpText}
      currentClientId={clientId}
      onSave={setClientId}
      redirectUri={redirectUri}
    />
    {clientId && (
      <LoginButton
        onLogin={login}
        isLoading={isLoading}
        serviceName={serviceName}
        icon={loginIcon}
        description={loginDescription}
        buttonClassName={loginButtonClass}
      />
    )}
  </div>
);
