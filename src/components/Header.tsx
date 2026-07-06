import React from 'react';

interface HeaderProps {
  user: { display_name: string; images: { url: string }[] } | null;
  onLogout: () => void;
  onShowHistory: () => void;
  onGoHome: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout, onShowHistory, onGoHome }) => {
  return (
    <header className="app-header">
      <button type="button" className="header-brand" onClick={onGoHome}>
        <svg className="logo-icon" width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path d="M8 12H24" stroke="var(--accent-color)" strokeWidth="3" strokeLinecap="round" />
          <path d="M19 7L24 12L19 17" stroke="var(--accent-color)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M24 20H8" stroke="var(--accent-color)" strokeWidth="3" strokeLinecap="round" />
          <path d="M13 15L8 20L13 25" stroke="var(--accent-color)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="logo-text">
          <h1>TransferMusic</h1>
          <p className="subtitle">Move your tracklists into Spotify — more services coming soon</p>
        </div>
      </button>

      {user && (
        <div className="user-profile">
          {user.images?.[0]?.url ? (
            <img src={user.images[0].url} alt={user.display_name} className="user-avatar" />
          ) : (
            <div className="user-avatar-placeholder">
              {user.display_name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="user-name">{user.display_name}</span>
          <button className="btn btn-sm btn-outline" onClick={onShowHistory}>
            History
          </button>
          <button className="btn btn-sm btn-outline-danger" onClick={onLogout}>
            Logout
          </button>
        </div>
      )}
    </header>
  );
};
