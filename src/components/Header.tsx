import React from 'react';

interface HeaderProps {
  user: { display_name: string; images: { url: string }[] } | null;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  return (
    <header className="app-header">
      <div className="header-brand">
        <div className="logo-icon">🎵</div>
        <div className="logo-text">
          <h1>TransferMusic</h1>
          <p className="subtitle">Import your plaintext tracklists directly into Spotify</p>
        </div>
      </div>
      
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
          <button className="btn btn-sm btn-outline-danger" onClick={onLogout}>
            Logout
          </button>
        </div>
      )}
    </header>
  );
};
