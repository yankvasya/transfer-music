import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { ImporterProgress } from './ImporterProgress';
import type { HistoryEntry } from '../hooks/useHistory';
import type { ResumeData } from '../types';
import type { ParsedTrack } from '../utils/parser';

interface ProgressRouteProps {
  activeImport: { id: string; resumeFrom?: ResumeData } | null;
  tracks: ParsedTrack[];
  playlistConfig: { name: string; description: string; isPublic: boolean } | null;
  history: HistoryEntry[];
  apiRequest: (endpoint: string, options?: RequestInit) => Promise<any>;
  onRestart: () => void;
  onBackToList: () => void;
  onSaveProgress: (
    id: string,
    summary: { name: string; url: string; matched: number; failed: number; total: number },
    resumeData: ResumeData
  ) => void;
  onImportComplete: (
    id: string,
    summary: { name: string; url: string; matched: number; failed: number; total: number }
  ) => void;
}

// Resolves /progress/:id either from the live in-memory session (normal navigation)
// or, after a reload/direct link wiped React state, by looking the id up in History
// and picking up exactly where its last checkpoint left off.
export const ProgressRoute: React.FC<ProgressRouteProps> = ({
  activeImport,
  tracks,
  playlistConfig,
  history,
  apiRequest,
  onRestart,
  onBackToList,
  onSaveProgress,
  onImportComplete,
}) => {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/" replace />;

  if (activeImport?.id === id && playlistConfig) {
    return (
      <ImporterProgress
        tracks={tracks}
        playlistName={playlistConfig.name}
        playlistDesc={playlistConfig.description}
        isPublic={playlistConfig.isPublic}
        apiRequest={apiRequest}
        onRestart={onRestart}
        onBackToList={onBackToList}
        historyId={id}
        resumeFrom={activeImport.resumeFrom}
        onSaveProgress={onSaveProgress}
        onImportComplete={onImportComplete}
      />
    );
  }

  const entry = history.find((h) => h.id === id);
  if (!entry || !entry.resumeData) {
    return <Navigate to="/history" replace />;
  }

  return (
    <ImporterProgress
      tracks={entry.resumeData.tracks}
      playlistName={entry.name}
      playlistDesc={entry.resumeData.playlistDesc}
      isPublic={entry.resumeData.isPublic}
      apiRequest={apiRequest}
      onRestart={onRestart}
      onBackToList={onBackToList}
      historyId={id}
      resumeFrom={entry.resumeData}
      onSaveProgress={onSaveProgress}
      onImportComplete={onImportComplete}
    />
  );
};
