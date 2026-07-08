import React from 'react';
import { ClientIdSetup } from './ClientIdSetup';
import { LoginButton } from './LoginButton';

interface ServiceAuth {
  clientId: string;
  setClientId: (id: string) => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
}

interface RequireAuthProps {
  auth: ServiceAuth;
  serviceName: string;
  helpText: string;
  loginDescription: string;
  loginIcon: string;
  loginButtonClass: string;
  redirectUri: string;
  children: React.ReactNode;
}

// Gates a single route behind one service's auth, instead of blocking the whole app —
// necessary now that more than one independently-authenticated service exists.
export const RequireAuth: React.FC<RequireAuthProps> = ({
  auth,
  serviceName,
  helpText,
  loginDescription,
  loginIcon,
  loginButtonClass,
  redirectUri,
  children,
}) => {
  if (auth.isLoading) {
    return (
      <div className="glass-panel center-align">
        <div className="spinner">Connecting to {serviceName}...</div>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <ClientIdSetup
          serviceName={serviceName}
          helpText={helpText}
          currentClientId={auth.clientId}
          onSave={auth.setClientId}
          redirectUri={redirectUri}
        />
        {auth.clientId && (
          <LoginButton
            onLogin={auth.login}
            isLoading={auth.isLoading}
            serviceName={serviceName}
            icon={loginIcon}
            description={loginDescription}
            buttonClassName={loginButtonClass}
          />
        )}
      </div>
    );
  }

  return <>{children}</>;
};
