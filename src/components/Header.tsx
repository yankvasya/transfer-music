import React, { useEffect, useRef, useState } from 'react';
import { ServiceIcon } from './ServiceIcon';
import type { ServiceId } from '../types';

export interface ConnectedAccount {
  service: ServiceId;
  serviceName: string;
  displayName: string;
  imageUrl?: string;
  onLogout: () => void;
}

interface HeaderProps {
  accounts: ConnectedAccount[];
  onShowHistory: () => void;
  onShowAbout: () => void;
  onGoHome: () => void;
}

// Logging into more than one or two services used to render each as its own inline chip,
// which crowded the header fast. Collapsed into a single "Accounts (N)" button that opens
// a dropdown listing each one instead.
export const Header: React.FC<HeaderProps> = ({ accounts, onShowHistory, onShowAbout, onGoHome }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

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
        {accounts.length > 0 && (
          <div className="accounts-menu" ref={containerRef}>
            <button type="button" className="btn btn-sm btn-outline" onClick={() => setOpen((v) => !v)}>
              👤 Accounts ({accounts.length})
            </button>
            {open && (
              <div className="accounts-dropdown">
                {accounts.map((account) => (
                  <div key={account.serviceName} className="accounts-dropdown-item">
                    {account.imageUrl ? (
                      <img src={account.imageUrl} alt={account.displayName} className="user-avatar" />
                    ) : (
                      <div className="user-avatar-placeholder">{account.displayName.charAt(0).toUpperCase()}</div>
                    )}
                    <span className="accounts-dropdown-service" title={account.serviceName}>
                      <ServiceIcon service={account.service} size={18} />
                    </span>
                    <span className="user-name">{account.displayName}</span>
                    <button className="btn btn-sm btn-outline-danger" onClick={account.onLogout}>
                      Logout
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <button className="btn btn-sm btn-outline" onClick={onShowAbout}>
          About
        </button>
        <button className="btn btn-sm btn-outline" onClick={onShowHistory}>
          History
        </button>
      </div>
    </header>
  );
};
