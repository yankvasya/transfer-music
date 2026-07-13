import { useState } from 'react';
import type { ReactNode } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useSpotify } from './hooks/useSpotify';
import { useYouTube } from './hooks/useYouTube';
import { useYandexMusic } from './hooks/useYandexMusic';
import { useDeezer } from './hooks/useDeezer';
import { useHistory } from './hooks/useHistory';
import type { HistoryEntry } from './hooks/useHistory';
import { Header } from './components/Header';
import { LandingPage } from './components/LandingPage';
import { SourceDestinationSelect } from './components/SourceDestinationSelect';
import type { ConnectorId } from './components/SourceDestinationSelect';
import { ImportRoute } from './components/ImportRoute';
import { PlaylistRoute } from './components/PlaylistRoute';
import { ExportRoute } from './components/ExportRoute';
import { BridgeRoute } from './components/BridgeRoute';
import { BridgeQueueRoute } from './components/BridgeQueueRoute';
import { ProgressRoute } from './components/ProgressRoute';
import { HistoryView } from './components/HistoryView';
import { OAuthLoginUI } from './components/OAuthLoginUI';
import { YandexDeviceLogin } from './components/YandexDeviceLogin';
import { DeezerLoginUI } from './components/DeezerLoginUI';
import { SERVICE_META } from './serviceMeta';
import type { ServiceAuth } from './serviceMeta';
import type { ParsedTrack } from './utils/parser';
import type { ResumeData, ServiceId } from './types';

const ALL_SERVICES: ServiceId[] = ['spotify', 'youtube', 'yandex-music', 'deezer'];

function App() {
  const spotify = useSpotify();
  const youtube = useYouTube();
  const yandex = useYandexMusic();
  const deezer = useDeezer();
  const { history, saveProgress, completeEntry, removeEntry, restoreHistory } = useHistory();
  const navigate = useNavigate();

  // Shown once, on a genuine first visit — every existing "back to start" navigation
  // elsewhere in the app already targets "/" expecting the picker, so gating this at the
  // root route (rather than moving the picker to a new path) means none of those call
  // sites needed to change: by the time a user can trigger one, they've necessarily
  // already passed this gate. /about always shows the same content on demand.
  const [hasSeenLanding, setHasSeenLanding] = useState(() => localStorage.getItem('transfer_music_seen_landing') === '1');
  const markLandingSeen = () => {
    localStorage.setItem('transfer_music_seen_landing', '1');
    setHasSeenLanding(true);
  };

  const authByService: Record<ServiceId, ServiceAuth> = {
    spotify: {
      isAuthenticated: spotify.isAuthenticated,
      isLoading: spotify.isLoading,
      user: spotify.user,
      logout: spotify.logout,
      apiRequest: spotify.apiRequest,
    },
    youtube: {
      isAuthenticated: youtube.isAuthenticated,
      isLoading: youtube.isLoading,
      user: youtube.user,
      logout: youtube.logout,
      apiRequest: youtube.apiRequest,
    },
    'yandex-music': {
      isAuthenticated: yandex.isAuthenticated,
      isLoading: yandex.isLoading,
      user: yandex.user,
      logout: yandex.logout,
      apiRequest: yandex.apiRequest,
    },
    deezer: {
      isAuthenticated: deezer.isAuthenticated,
      isLoading: deezer.isLoading,
      user: deezer.user,
      logout: deezer.logout,
      apiRequest: deezer.apiRequest,
    },
  };

  // Builds the service-specific login screen shown when a route is gated by RequireAuth.
  // Spotify/YouTube share the redirect-OAuth UI (each brings its own Client ID setup);
  // Yandex's device flow and Deezer's two-field (App ID + Secret) redirect flow each need
  // their own UI.
  const renderLoginUI = (service: ServiceId): ReactNode => {
    const meta = SERVICE_META[service];
    if (service === 'yandex-music') {
      return (
        <YandexDeviceLogin
          deviceCode={yandex.deviceCode}
          authStatus={yandex.authStatus}
          authError={yandex.authError}
          onStart={yandex.startDeviceAuth}
          onCancel={yandex.cancelDeviceAuth}
        />
      );
    }
    if (service === 'deezer') {
      return <DeezerLoginUI isConfigured={deezer.isConfigured} isLoading={deezer.isLoading} login={deezer.login} />;
    }
    const hook = service === 'spotify' ? spotify : youtube;
    return (
      <OAuthLoginUI
        isConfigured={hook.isConfigured}
        isLoading={hook.isLoading}
        login={hook.login}
        serviceName={meta.name}
        loginDescription={meta.loginDescription}
        loginIcon={meta.icon}
        loginButtonClass={meta.buttonClass}
      />
    );
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
    } else if (to === 'plain-text') {
      navigate(`/export?type=${from}`);
    } else {
      // Both sides are real services — go straight from one into the other.
      navigate(`/bridge?from=${from}&to=${to}`);
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

  const isBooting = spotify.isLoading && youtube.isLoading && yandex.isLoading && deezer.isLoading;

  const accounts = ALL_SERVICES
    .filter((id) => authByService[id].isAuthenticated && authByService[id].user)
    .map((id) => {
      const auth = authByService[id];
      const user = auth.user!;
      return {
        serviceName: SERVICE_META[id].name,
        icon: SERVICE_META[id].icon,
        displayName: user.display_name,
        imageUrl: user.images?.[0]?.url,
        onLogout: auth.logout,
      };
    });

  return (
    <div className="app-container">
      <Header
        accounts={accounts}
        onShowHistory={() => navigate('/history')}
        onShowAbout={() => navigate('/about')}
        onGoHome={handleGoHome}
      />

      {isBooting ? (
        <div className="glass-panel center-align">
          <div className="spinner">Loading...</div>
        </div>
      ) : (
        <main>
          <Routes>
            <Route
              path="/"
              element={
                hasSeenLanding ? (
                  <SourceDestinationSelect onContinue={handleConnectorContinue} />
                ) : (
                  <LandingPage onGetStarted={markLandingSeen} />
                )
              }
            />

            <Route path="/about" element={<LandingPage onGetStarted={() => navigate('/')} />} />

            <Route
              path="/import"
              element={
                <ImportRoute
                  authByService={authByService}
                  renderLoginUI={renderLoginUI}
                  rawText={rawText}
                  onNext={handleTracksNext}
                />
              }
            />

            <Route
              path="/export"
              element={<ExportRoute authByService={authByService} renderLoginUI={renderLoginUI} />}
            />

            <Route
              path="/bridge"
              element={<BridgeRoute authByService={authByService} renderLoginUI={renderLoginUI} />}
            />

            <Route
              path="/bridge-queue"
              element={
                <BridgeQueueRoute
                  authByService={authByService}
                  renderLoginUI={renderLoginUI}
                  onSaveProgress={saveProgress}
                  onImportComplete={completeEntry}
                />
              }
            />

            <Route
              path="/playlist"
              element={
                <PlaylistRoute
                  authByService={authByService}
                  renderLoginUI={renderLoginUI}
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
                  renderLoginUI={renderLoginUI}
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
                  onImportHistory={restoreHistory}
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
