import React from 'react';

export interface ConnectedAccount {
  serviceName: string;
  displayName: string;
  imageUrl?: string;
  onLogout: () => void;
}

interface HeaderProps {
  accounts: ConnectedAccount[];
  onShowHistory: () => void;
  onGoHome: () => void;
}

export const Header: React.FC<HeaderProps> = ({ accounts, onShowHistory, onGoHome }) => {
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
          <p className="subtitle">Move your tracklists between music services</p>
        </div>
      </button>

      <div className="header-actions">
        {accounts.map((account) => (
          <div key={account.serviceName} className="user-profile">
            {account.imageUrl ? (
              <img src={account.imageUrl} alt={account.displayName} className="user-avatar" />
            ) : (
              <div className="user-avatar-placeholder">{account.displayName.charAt(0).toUpperCase()}</div>
            )}
            <span className="user-name">{account.displayName}</span>
            <button className="btn btn-sm btn-outline-danger" onClick={account.onLogout}>
              Logout {account.serviceName}
            </button>
          </div>
        ))}
        <button className="btn btn-sm btn-outline" onClick={onShowHistory}>
          History
        </button>
      </div>
    </header>
  );
};
