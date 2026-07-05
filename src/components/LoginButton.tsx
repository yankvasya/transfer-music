import React from 'react';

interface LoginButtonProps {
  onLogin: () => void;
  isLoading: boolean;
}

export const LoginButton: React.FC<LoginButtonProps> = ({ onLogin, isLoading }) => {
  return (
    <div className="login-panel glass-panel center-align">
      <div className="login-icon-large">🟢</div>
      <h2>Connect to Spotify</h2>
      <p className="description-text">
        Log in with your Spotify account to authorize creating playlists and importing your tracks.
      </p>
      
      <button 
        className="btn btn-spotify btn-lg" 
        onClick={onLogin} 
        disabled={isLoading}
      >
        {isLoading ? (
          <span className="spinner">Connecting...</span>
        ) : (
          <>
            <span className="spotify-logo-small">🟢</span> Login with Spotify
          </>
        )}
      </button>
      
      <p className="security-note">
        Note: We use client-side authentication (PKCE). Your credentials and tokens are stored safely in your own browser and never uploaded to any server.
      </p>
    </div>
  );
};
