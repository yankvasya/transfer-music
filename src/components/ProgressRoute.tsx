import React from 'react';
import type { ReactNode } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { ImporterProgress } from './ImporterProgress';
import { RequireAuth } from './RequireAuth';
import { DESTINATIONS } from '../connectors';
import { SERVICE_META } from '../serviceMeta';
import type { ServiceAuth } from '../serviceMeta';
import type { HistoryEntry } from '../hooks/useHistory';
import type { ResumeData, ServiceId } from '../types';
import type { ParsedTrack } from '../utils/parser';

interface ProgressRouteProps {
  activeImport: { id: string; service: ServiceId; resumeFrom?: ResumeData } | null;
  tracks: ParsedTrack[];
  playlistConfig: { name: string; description: string; isPublic: boolean } | null;
  history: HistoryEntry[];
  authByService: Record<ServiceId, ServiceAuth>;
  renderLoginUI: (service: ServiceId) => ReactNode;
  onRestart: () => void;
  onBackToList: () => void;
  onSaveProgress: (
    id: string,
    summary: { service: ServiceId; name: string; url: string; matched: number; failed: number; total: number },
    resumeData: ResumeData
  ) => void;
  onImportComplete: (
    id: string,
    summary: { service: ServiceId; name: string; url: string; matched: number; failed: number; total: number }
  ) => void;
}

// Resolves /progress/:id either from the live in-memory session (normal navigation)
// or, after a reload/direct link wiped React state, by looking the id up in History
// and picking up exactly where its last checkpoint left off. Either way, the service
// recorded on the import (or its History entry) decides which connector/API/auth to use.
export const ProgressRoute: React.FC<ProgressRouteProps> = ({
  activeImport,
  tracks,
  playlistConfig,
  history,
  authByService,
  renderLoginUI,
  onRestart,
  onBackToList,
  onSaveProgress,
  onImportComplete,
}) => {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/" replace />;

  const service: ServiceId | null =
    activeImport?.id === id && playlistConfig
      ? activeImport.service
      : (history.find((h) => h.id === id)?.resumeData?.service ?? null);

  if (!service) {
    return <Navigate to="/history" replace />;
  }

  const meta = SERVICE_META[service];
  const auth = authByService[service];

  const content =
    activeImport?.id === id && playlistConfig ? (
      <ImporterProgress
        tracks={tracks}
        playlistName={playlistConfig.name}
        playlistDesc={playlistConfig.description}
        isPublic={playlistConfig.isPublic}
        apiRequest={auth.apiRequest}
        connector={DESTINATIONS[service]}
        onRestart={onRestart}
        onBackToList={onBackToList}
        historyId={id}
        resumeFrom={activeImport.resumeFrom}
        onSaveProgress={onSaveProgress}
        onImportComplete={onImportComplete}
      />
    ) : (
      (() => {
        const entry = history.find((h) => h.id === id);
        if (!entry || !entry.resumeData) return <Navigate to="/history" replace />;
        return (
          <ImporterProgress
            tracks={entry.resumeData.tracks}
            playlistName={entry.name}
            playlistDesc={entry.resumeData.playlistDesc}
            isPublic={entry.resumeData.isPublic}
            apiRequest={auth.apiRequest}
            connector={DESTINATIONS[service]}
            onRestart={onRestart}
            onBackToList={onBackToList}
            historyId={id}
            resumeFrom={entry.resumeData}
            onSaveProgress={onSaveProgress}
            onImportComplete={onImportComplete}
          />
        );
      })()
    );

  return (
    <RequireAuth isAuthenticated={auth.isAuthenticated} isLoading={auth.isLoading} serviceName={meta.name} loginUI={renderLoginUI(service)}>
      {content}
    </RequireAuth>
  );
};
