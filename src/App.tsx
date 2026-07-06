import { useState, useRef } from 'react';
import { useSpotify } from './hooks/useSpotify';
import { useHistory } from './hooks/useHistory';
import { Header } from './components/Header';
import { ClientIdSetup } from './components/ClientIdSetup';
import { LoginButton } from './components/LoginButton';
import { TrackInput } from './components/TrackInput';
import { PlaylistSetup } from './components/PlaylistSetup';
import { ImporterProgress } from './components/ImporterProgress';
import { HistoryView } from './components/HistoryView';
import type { ParsedTrack } from './utils/parser';

type Step = 'input' | 'playlist' | 'progress' | 'history';

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

  const { history, addEntry } = useHistory();

  // Wizard state
  const [step, setStep] = useState<Step>('input');
  const previousStepRef = useRef<Step>('input');

  // Importer data state
  const [rawText, setRawText] = useState<string>('');
  const [tracks, setTracks] = useState<ParsedTrack[]>([]);
  const [playlistConfig, setPlaylistConfig] = useState<{
    name: string;
    description: string;
    isPublic: boolean;
  } | null>(null);

  const handleTracksNext = (parsedTracks: ParsedTrack[], text: string) => {
    setTracks(parsedTracks);
    setRawText(text);
    setStep('playlist');
  };

  const handlePlaylistStart = (name: string, description: string, isPublic: boolean) => {
    setPlaylistConfig({ name, description, isPublic });
    setStep('progress');
  };

  const handleRestart = () => {
    setRawText('');
    setTracks([]);
    setPlaylistConfig(null);
    setStep('input');
  };

  // Returns to the tracklist step without discarding what was already entered/imported.
  const handleBackToList = () => {
    setStep('input');
  };

  const handleShowHistory = () => {
    previousStepRef.current = step;
    setStep('history');
  };

  const handleHistoryBack = () => {
    setStep(previousStepRef.current);
  };

  const getRedirectUri = () => {
    const envUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;
    if (envUri) return envUri;
    return window.location.origin + window.location.pathname;
  };

  return (
    <div className="app-container">
      <Header user={user} onLogout={logout} onShowHistory={handleShowHistory} />

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
          {step === 'input' && (
            <TrackInput initialText={rawText} onNext={handleTracksNext} />
          )}
          
          {step === 'playlist' && (
            <PlaylistSetup
              trackCount={tracks.length}
              apiRequest={apiRequest}
              onBack={() => setStep('input')}
              onStart={handlePlaylistStart}
            />
          )}

          {step === 'progress' && playlistConfig && (
            <ImporterProgress
              tracks={tracks}
              playlistName={playlistConfig.name}
              playlistDesc={playlistConfig.description}
              isPublic={playlistConfig.isPublic}
              apiRequest={apiRequest}
              onRestart={handleRestart}
              onBackToList={handleBackToList}
              onImportComplete={addEntry}
            />
          )}

          {step === 'history' && (
            <HistoryView history={history} onBack={handleHistoryBack} />
          )}
        </main>
      )}
    </div>
  );
}

export default App;
