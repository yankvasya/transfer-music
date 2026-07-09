import React from 'react';

interface LoginButtonProps {
  onLogin: () => void;
  isLoading: boolean;
  serviceName?: string;
  icon?: string;
  description?: string;
  buttonClassName?: string;
  securityNote?: string;
}

export const LoginButton: React.FC<LoginButtonProps> = ({
  onLogin,
  isLoading,
  serviceName = 'Spotify',
  icon = '🟢',
  description = 'Log in with your Spotify account to authorize creating playlists and importing your tracks.',
  buttonClassName = 'btn-spotify',
  securityNote = 'Note: We use client-side authentication (PKCE). Your credentials and tokens are stored safely in your own browser and never uploaded to any server.',
}) => {
  return (
    <div className="login-panel glass-panel center-align">
      <div className="login-icon-large">{icon}</div>
      <h2>Connect to {serviceName}</h2>
      <p className="description-text">{description}</p>

      <button
        className={`btn ${buttonClassName} btn-lg`}
        onClick={onLogin}
        disabled={isLoading}
      >
        {isLoading ? (
          <span className="spinner">Connecting...</span>
        ) : (
          <>
            <span className="spotify-logo-small">{icon}</span> Login with {serviceName}
          </>
        )}
      </button>

      <p className="security-note">{securityNote}</p>
    </div>
  );
};
