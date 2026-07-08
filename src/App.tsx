import { useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useSpotify } from './hooks/useSpotify';
import { useYouTube } from './hooks/useYouTube';
import { useHistory } from './hooks/useHistory';
import type { HistoryEntry } from './hooks/useHistory';
import { Header } from './components/Header';
import { SourceDestinationSelect } from './components/SourceDestinationSelect';
import type { ConnectorId } from './components/SourceDestinationSelect';
import { ImportRoute } from './components/ImportRoute';
import { PlaylistRoute } from './components/PlaylistRoute';
import { ExportRoute } from './components/ExportRoute';
import { ProgressRoute } from './components/ProgressRoute';
import { HistoryView } from './components/HistoryView';
import { SERVICE_META } from './serviceMeta';
import type { ServiceAuth } from './serviceMeta';
import type { ParsedTrack } from './utils/parser';
import type { ResumeData, ServiceId } from './types';

function App() {
  const spotify = useSpotify();
  const youtube = useYouTube();
  const { history, saveProgress, completeEntry, removeEntry } = useHistory();
  const navigate = useNavigate();

  // Both services fall back to the exact same redirect URI (site root), so one value
  // covers whichever Developer Dashboard / Google Cloud console the user is configuring.
  const redirectUri = (import.meta.env.VITE_SPOTIFY_REDIRECT_URI as string | undefined) || window.location.origin + '/';

  const authByService: Record<ServiceId, ServiceAuth> = {
    spotify: {
      clientId: spotify.clientId,
      setClientId: spotify.setClientId,
      isAuthenticated: spotify.isAuthenticated,
      isLoading: spotify.isLoading,
      login: spotify.login,
      user: spotify.user,
      logout: spotify.logout,
      apiRequest: spotify.apiRequest,
    },
    youtube: {
      clientId: youtube.clientId,
      setClientId: youtube.setClientId,
      isAuthenticated: youtube.isAuthenticated,
      isLoading: youtube.isLoading,
      login: youtube.login,
      user: youtube.user,
      logout: youtube.logout,
      apiRequest: youtube.apiRequest,
    },
  };

  // Importer data state (in-memory; /progress/:id survives a reload via History instead)
  const [rawText, setRawText] = useState<string>('');
  const [tracks, setTracks] = useState<ParsedTrack[]>([]);
  const [playlistConfig, setPlaylistConfig] = useState<{
    name: string;
    description: string;
    isPublic: boolean;
  } | null>(null);
  // Identifies the history entry a running import checkpoints into, and (when resuming) what to pick up from.
  const [activeImport, setActiveImport] = useState<{ id: string; service: ServiceId; resumeFrom?: ResumeData } | null>(
    null
  );

  const handleTracksNext = (parsedTracks: ParsedTrack[], text: string, service: ServiceId) => {
    setTracks(parsedTracks);
    setRawText(text);
    navigate(`/playlist?type=${service}`);
  };

  const handlePlaylistStart = (name: string, description: string, isPublic: boolean, service: ServiceId) => {
    const id = crypto.randomUUID();
    setPlaylistConfig({ name, description, isPublic });
    setActiveImport({ id, service });
    navigate(`/progress/${id}`);
  };

  const handleRestart = () => {
    setRawText('');
    setTracks([]);
    setPlaylistConfig(null);
    setActiveImport(null);
    navigate('/');
  };

  // Returns to the tracklist step without discarding what was already entered/imported.
  const handleBackToList = () => navigate(`/import?type=${activeImport?.service ?? 'spotify'}`);

  const handleGoHome = () => navigate('/');

  const handleConnectorContinue = (from: ConnectorId, to: ConnectorId) => {
    if (from === 'plain-text') {
      navigate(`/import?type=${to}`);
    } else {
      // Only service -> plain-text is supported besides plain-text -> service.
      navigate(`/export?type=${from}`);
    }
  };

  const handleResumeImport = (entry: HistoryEntry) => {
    if (!entry.resumeData) return;
    setTracks(entry.resumeData.tracks);
    setPlaylistConfig({
      name: entry.name,
      description: entry.resumeData.playlistDesc,
      isPublic: entry.resumeData.isPublic,
    });
    setActiveImport({ id: entry.id, service: entry.resumeData.service, resumeFrom: entry.resumeData });
    navigate(`/progress/${entry.id}`);
  };

  const isBooting = spotify.isLoading && youtube.isLoading;

  const accounts = (['spotify', 'youtube'] as ServiceId[])
    .filter((id) => authByService[id].isAuthenticated && authByService[id].user)
    .map((id) => {
      const auth = authByService[id];
      const user = auth.user!;
      return {
        serviceName: SERVICE_META[id].name,
        displayName: user.display_name,
        imageUrl: user.images?.[0]?.url,
        onLogout: auth.logout,
      };
    });

  return (
    <div className="app-container">
      <Header accounts={accounts} onShowHistory={() => navigate('/history')} onGoHome={handleGoHome} />

      {isBooting ? (
        <div className="glass-panel center-align">
          <div className="spinner">Loading...</div>
        </div>
      ) : (
        <main>
          <Routes>
            <Route path="/" element={<SourceDestinationSelect onContinue={handleConnectorContinue} />} />

            <Route
              path="/import"
              element={
                <ImportRoute
                  authByService={authByService}
                  redirectUri={redirectUri}
                  rawText={rawText}
                  onNext={handleTracksNext}
                />
              }
            />

            <Route
              path="/export"
              element={<ExportRoute authByService={authByService} redirectUri={redirectUri} />}
            />

            <Route
              path="/playlist"
              element={
                <PlaylistRoute
                  authByService={authByService}
                  redirectUri={redirectUri}
                  tracks={tracks}
                  onStart={handlePlaylistStart}
                />
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
                  authByService={authByService}
                  redirectUri={redirectUri}
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
