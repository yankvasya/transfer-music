import React from 'react';
import type { ReactNode } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { BridgeQueue } from './BridgeQueue';
import { RequireAuth } from './RequireAuth';
import { SOURCES, DESTINATIONS } from '../connectors';
import { SERVICE_META } from '../serviceMeta';
import type { ServiceAuth } from '../serviceMeta';
import { resolveService } from '../utils/resolveService';
import type { ResumeData, ServiceId } from '../types';

interface BridgeQueueRouteProps {
  authByService: Record<ServiceId, ServiceAuth>;
  renderLoginUI: (service: ServiceId) => ReactNode;
  onSaveProgress: (
    id: string,
    summary: { service: ServiceId; name: string; url: string; matched: number; failed: number; duplicates: number; total: number },
    resumeData: ResumeData
  ) => void;
  onImportComplete: (
    id: string,
    summary: { service: ServiceId; name: string; url: string; matched: number; failed: number; duplicates: number; total: number }
  ) => void;
}

export const BridgeQueueRoute: React.FC<BridgeQueueRouteProps> = ({
  authByService,
  renderLoginUI,
  onSaveProgress,
  onImportComplete,
}) => {
  const [searchParams] = useSearchParams();
  const from = resolveService(searchParams, 'from');
  const to = resolveService(searchParams, 'to');
  const playlistIds = (searchParams.get('playlist_ids') || '').split(',').filter(Boolean);

  const fromAuth = authByService[from];
  const toAuth = authByService[to];

  if (playlistIds.length === 0) {
    return <Navigate to="/" replace />;
  }

  return (
    <RequireAuth
      isAuthenticated={fromAuth.isAuthenticated}
      isLoading={fromAuth.isLoading}
      serviceName={SERVICE_META[from].name}
      loginUI={renderLoginUI(from)}
    >
      <RequireAuth
        isAuthenticated={toAuth.isAuthenticated}
        isLoading={toAuth.isLoading}
        serviceName={SERVICE_META[to].name}
        loginUI={renderLoginUI(to)}
      >
        <BridgeQueue
          to={to}
          playlistIds={playlistIds}
          source={SOURCES[from]}
          destination={DESTINATIONS[to]}
          sourceApiRequest={fromAuth.apiRequest}
          destApiRequest={toAuth.apiRequest}
          onSaveProgress={onSaveProgress}
          onImportComplete={onImportComplete}
        />
      </RequireAuth>
    </RequireAuth>
  );
};
