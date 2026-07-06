import { useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useSpotify } from './hooks/useSpotify';
import { useHistory } from './hooks/useHistory';
import type { HistoryEntry } from './hooks/useHistory';
import { Header } from './components/Header';
import { ClientIdSetup } from './components/ClientIdSetup';
import { LoginButton } from './components/LoginButton';
import { SourceDestinationSelect } from './components/SourceDestinationSelect';
import { TrackInput } from './components/TrackInput';
import { PlaylistSetup } from './components/PlaylistSetup';
import { ProgressRoute } from './components/ProgressRoute';
import { HistoryView } from './components/HistoryView';
import type { ParsedTrack } from './utils/parser';
import type { ResumeData } from './types';

function App() {
  const {
    clientId,
    setClientId,
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    apiRequest,
  } = useSpotify();

  const { history, saveProgress, completeEntry, removeEntry } = useHistory();
  const navigate = useNavigate();

  // Importer data state (in-memory; /progress/:id survives a reload via History instead)
  const [rawText, setRawText] = useState<string>('');
  const [tracks, setTracks] = useState<ParsedTrack[]>([]);
  const [playlistConfig, setPlaylistConfig] = useState<{
    name: string;
    description: string;
    isPublic: boolean;
  } | null>(null);
  // Identifies the history entry a running import checkpoints into, and (when resuming) what to pick up from.
  const [activeImport, setActiveImport] = useState<{ id: string; resumeFrom?: ResumeData } | null>(null);

  const handleTracksNext = (parsedTracks: ParsedTrack[], text: string) => {
    setTracks(parsedTracks);
    setRawText(text);
    navigate('/playlist');
  };

  const handlePlaylistStart = (name: string, description: string, isPublic: boolean) => {
    const id = crypto.randomUUID();
    setPlaylistConfig({ name, description, isPublic });
    setActiveImport({ id });
    navigate(`/progress/${id}`);
  };

  const handleRestart = () => {
    setRawText('');
    setTracks([]);
    setPlaylistConfig(null);
    setActiveImport(null);
    navigate('/import');
  };

  // Returns to the tracklist step without discarding what was already entered/imported.
  const handleBackToList = () => navigate('/import');

  const handleGoHome = () => navigate('/');

  const handleResumeImport = (entry: HistoryEntry) => {
    if (!entry.resumeData) return;
    setTracks(entry.resumeData.tracks);
    setPlaylistConfig({
      name: entry.name,
      description: entry.resumeData.playlistDesc,
      isPublic: entry.resumeData.isPublic,
    });
    setActiveImport({ id: entry.id, resumeFrom: entry.resumeData });
    navigate(`/progress/${entry.id}`);
  };

  const getRedirectUri = () => {
    const envUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;
    if (envUri) return envUri;
    return window.location.origin + window.location.pathname;
  };

  return (
    <div className="app-container">
      <Header user={user} onLogout={logout} onShowHistory={() => navigate('/history')} onGoHome={handleGoHome} />

      {/* Loading state */}
      {isLoading && (
        <div className="glass-panel center-align">
          <div className="spinner">Connecting to Spotify...</div>
        </div>
      )}

      {/* Authentication Steps */}
      {!isLoading && !isAuthenticated && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <ClientIdSetup
            currentClientId={clientId}
            onSave={setClientId}
            redirectUri={getRedirectUri()}
          />
          {clientId && (
            <LoginButton onLogin={login} isLoading={isLoading} />
          )}
        </div>
      )}

      {/* Importer Steps */}
      {!isLoading && isAuthenticated && (
        <main>
          <Routes>
            <Route path="/" element={<SourceDestinationSelect onContinue={() => navigate('/import')} />} />

            <Route path="/import" element={<TrackInput initialText={rawText} onNext={handleTracksNext} />} />

            <Route
              path="/playlist"
              element={
                tracks.length === 0 ? (
                  <Navigate to="/import" replace />
                ) : (
                  <PlaylistSetup
                    trackCount={tracks.length}
                    apiRequest={apiRequest}
                    onBack={() => navigate('/import')}
                    onStart={handlePlaylistStart}
                  />
                )
              }
            />

            <Route
              path="/progress/:id"
              element={
                <ProgressRoute
                  activeImport={activeImport}
                  tracks={tracks}
                  playlistConfig={playlistConfig}
                  history={history}
                  apiRequest={apiRequest}
                  onRestart={handleRestart}
                  onBackToList={handleBackToList}
                  onSaveProgress={saveProgress}
                  onImportComplete={completeEntry}
                />
              }
            />

            <Route
              path="/history"
              element={
                <HistoryView
                  history={history}
                  onBack={() => navigate('/')}
                  onResume={handleResumeImport}
                  onDelete={removeEntry}
                />
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      )}
    </div>
  );
}

export default App;
