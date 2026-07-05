import React, { useState, useEffect, useRef } from 'react';
import type { ParsedTrack } from '../utils/parser';

interface ImporterProgressProps {
  tracks: ParsedTrack[];
  playlistName: string;
  playlistDesc: string;
  isPublic: boolean;
  apiRequest: (endpoint: string, options?: RequestInit) => Promise<any>;
  onRestart: () => void;
}

interface MatchResult {
  track: ParsedTrack;
  spotifyName?: string;
  spotifyArtist?: string;
  uri?: string;
  url?: string;
  success: boolean;
  errorReason?: string;
}

export const ImporterProgress: React.FC<ImporterProgressProps> = ({
  tracks,
  playlistName,
  playlistDesc,
  isPublic,
  apiRequest,
  onRestart,
}) => {
  const [status, setStatus] = useState<'creating' | 'importing' | 'paused' | 'completed' | 'failed'>('creating');
  const [progress, setProgress] = useState(0); // 0 to 100
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null);
  
  const [matchedTracks, setMatchedTracks] = useState<MatchResult[]>([]);
  const [failedTracks, setFailedTracks] = useState<MatchResult[]>([]);
  
  const [currentActionMsg, setCurrentActionMsg] = useState('Initializing...');

  const isPausedRef = useRef(false);
  const isCancelledRef = useRef(false);
  
  // Buffers to batch track additions to Spotify playlist (max 100 tracks per call)
  const pendingUrisRef = useRef<string[]>([]);
  const matchedCountRef = useRef(0);

  // Toggle pause state
  const handlePauseToggle = () => {
    if (status === 'importing') {
      isPausedRef.current = true;
      setStatus('paused');
      setCurrentActionMsg('Paused. Waiting to resume...');
    } else if (status === 'paused') {
      isPausedRef.current = false;
      setStatus('importing');
    }
  };

  // Stop import early
  const handleCancel = () => {
    if (confirm('Are you sure you want to stop the import process? Any tracks imported so far will remain in your playlist.')) {
      isCancelledRef.current = true;
      setStatus('completed');
      setCurrentActionMsg('Import stopped by user.');
    }
  };

  // Download failed tracks as text file
  const downloadFailedTracks = () => {
    const textContent = failedTracks
      .map((item) => item.track.raw)
      .join('\n');
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `failed_tracks_${playlistName.replace(/\s+/g, '_')}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Main Importer Loop
  useEffect(() => {
    let active = true;

    const startImport = async () => {
      try {
        // 1. Get Current User ID
        setCurrentActionMsg('Fetching user details...');
        const userProfile = await apiRequest('/me');
        if (!active || isCancelledRef.current) return;

        // 2. Create the Spotify Playlist
        setCurrentActionMsg(`Creating playlist: "${playlistName}"...`);
        const playlistData = await apiRequest(`/users/${userProfile.id}/playlists`, {
          method: 'POST',
          body: JSON.stringify({
            name: playlistName,
            description: playlistDesc,
            public: isPublic,
          }),
        });

        if (!active || isCancelledRef.current) return;
        setPlaylistUrl(playlistData.external_urls.spotify);
        setStatus('importing');

        // Helper to add current batch of tracks to the playlist
        const flushBatchToPlaylist = async (playlistIdStr: string) => {
          if (pendingUrisRef.current.length === 0) return;
          const urisToAdd = [...pendingUrisRef.current];
          pendingUrisRef.current = []; // Clear buffer immediately to prevent double adds

          setCurrentActionMsg(`Adding ${urisToAdd.length} tracks to your playlist...`);
          
          let success = false;
          while (!success && active && !isCancelledRef.current) {
            const res = await apiRequest(`/playlists/${playlistIdStr}/tracks`, {
              method: 'POST',
              body: JSON.stringify({ uris: urisToAdd }),
            });

            if (res && res.isRateLimited) {
              // Rate limited, wait and retry
              let waitSec = res.waitSeconds;
              while (waitSec > 0 && active && !isCancelledRef.current) {
                setCurrentActionMsg(`Rate limited by Spotify! Retrying in ${waitSec}s...`);
                await new Promise((resolve) => setTimeout(resolve, 1000));
                waitSec--;
              }
            } else {
              success = true;
            }
          }
        };

        // 3. Process Tracks sequentially
        for (let i = 0; i < tracks.length; i++) {
          if (!active) return;

          // Check if cancelled
          if (isCancelledRef.current) {
            break;
          }

          // Check if paused
          while (isPausedRef.current && active && !isCancelledRef.current) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
          if (!active || isCancelledRef.current) return;

          const track = tracks[i];
          setCurrentIndex(i);
          setProgress(Math.round(((i) / tracks.length) * 100));
          setCurrentActionMsg(`Searching track ${i + 1} of ${tracks.length}: "${track.raw}"...`);

          // Search Spotify for the track
          let searchResult = null;
          let searchSuccess = false;

          while (!searchSuccess && active && !isCancelledRef.current) {
            // Build search query: artist:Artist track:Title
            let query = '';
            if (track.artist) {
              query = `artist:${track.artist} track:${track.title}`;
            } else {
              query = track.title;
            }

            try {
              const res = await apiRequest(`/search?q=${encodeURIComponent(query)}&type=track&limit=1`);

              if (res && res.isRateLimited) {
                // Rate limited, handle wait
                let waitSec = res.waitSeconds;
                while (waitSec > 0 && active && !isCancelledRef.current) {
                  setCurrentActionMsg(`Rate limited! Waiting ${waitSec}s...`);
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                  waitSec--;
                }
              } else {
                searchResult = res;
                searchSuccess = true;
              }
            } catch (err: any) {
              console.error(`Search error for track "${track.raw}":`, err);
              searchResult = null;
              searchSuccess = true; // Break loop, treat as search fail
            }
          }

          if (!active || isCancelledRef.current) return;

          // Process Search Result
          const spotifyTrack = searchResult?.tracks?.items?.[0];
          if (spotifyTrack) {
            const result: MatchResult = {
              track,
              spotifyName: spotifyTrack.name,
              spotifyArtist: spotifyTrack.artists.map((a: any) => a.name).join(', '),
              uri: spotifyTrack.uri,
              url: spotifyTrack.external_urls.spotify,
              success: true,
            };
            setMatchedTracks((prev) => [result, ...prev]);
            pendingUrisRef.current.push(spotifyTrack.uri);
            matchedCountRef.current++;
          } else {
            const result: MatchResult = {
              track,
              success: false,
              errorReason: 'Track not found on Spotify',
            };
            setFailedTracks((prev) => [result, ...prev]);
          }

          // If buffer has 100 items, flush to Spotify playlist to stay under limits
          if (pendingUrisRef.current.length >= 100) {
            await flushBatchToPlaylist(playlistData.id);
          }

          // Throttling delay to avoid aggressive rate limits (approx 150ms)
          await new Promise((resolve) => setTimeout(resolve, 150));
        }

        // 4. Final flush for remaining tracks in buffer
        if (pendingUrisRef.current.length > 0 && !isCancelledRef.current && active) {
          await flushBatchToPlaylist(playlistData.id);
        }

        // Finish Import
        if (active) {
          setProgress(100);
          setCurrentIndex(tracks.length);
          setStatus('completed');
          setCurrentActionMsg('Playlist import completed successfully!');
        }
      } catch (err: any) {
        console.error('Import failed with critical error:', err);
        if (active) {
          setStatus('failed');
          setCurrentActionMsg(`Critical Error: ${err.message || 'Something went wrong.'}`);
        }
      }
    };

    startImport();

    return () => {
      active = false;
    };
  }, [tracks, playlistName, playlistDesc, isPublic, apiRequest]);



  return (
    <div className="importer-progress-panel glass-panel">
      <h2>🚀 Importing Playlist</h2>
      <p className="description-text">{currentActionMsg}</p>

      {/* Progress Bar Container */}
      <div className="progress-container">
        <div className="progress-bar-bg">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
        </div>
        <div className="progress-labels">
          <span>{progress}% Completed</span>
          <span>{currentIndex} / {tracks.length} tracks processed</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stats-row">
        <div className="stat-card success">
          <div className="stat-value">{matchedTracks.length}</div>
          <div className="stat-label">Successfully Matched</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-value">{failedTracks.length}</div>
          <div className="stat-label">Not Found</div>
        </div>
      </div>

      {/* Control Actions during Import */}
      {(status === 'importing' || status === 'paused') && (
        <div className="form-actions center-align">
          <button className="btn btn-outline" onClick={handlePauseToggle}>
            {status === 'paused' ? '▶ Resume' : '⏸ Pause'}
          </button>
          <button className="btn btn-danger" onClick={handleCancel}>
            ⏹ Stop Import
          </button>
        </div>
      )}

      {/* Complete/Failed Screen */}
      {(status === 'completed' || status === 'failed') && (
        <div className="completion-card">
          {status === 'completed' ? (
            <div className="badge-wrapper success">🎉 Done!</div>
          ) : (
            <div className="badge-wrapper danger">❌ Failed</div>
          )}

          <div className="form-actions center-align mt-4">
            {playlistUrl && (
              <a href={playlistUrl} target="_blank" rel="noopener noreferrer" className="btn btn-success btn-lg">
                🟢 Open Spotify Playlist
              </a>
            )}
            <button className="btn btn-primary" onClick={onRestart}>
              Import Another Playlist
            </button>
          </div>
        </div>
      )}

      {/* Output Lists */}
      <div className="log-container">
        <div className="log-panel">
          <h4>Matched ({matchedTracks.length})</h4>
          <div className="log-list">
            {matchedTracks.map((item, idx) => (
              <div key={idx} className="log-item success">
                <span className="log-item-raw">{item.track.raw}</span>
                <span className="arrow">➔</span>
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="log-item-spotify">
                  {item.spotifyArtist} - {item.spotifyName}
                </a>
              </div>
            ))}
            {matchedTracks.length === 0 && <div className="empty-log">No tracks matched yet...</div>}
          </div>
        </div>

        <div className="log-panel">
          <div className="log-header-row">
            <h4>Not Found ({failedTracks.length})</h4>
            {failedTracks.length > 0 && (
              <button className="btn btn-sm btn-outline-danger" onClick={downloadFailedTracks}>
                ⬇ Download List
              </button>
            )}
          </div>
          <div className="log-list">
            {failedTracks.map((item, idx) => (
              <div key={idx} className="log-item danger">
                <span className="log-item-raw">{item.track.raw}</span>
                <span className="log-item-error">({item.errorReason})</span>
              </div>
            ))}
            {failedTracks.length === 0 && <div className="empty-log">No missed tracks...</div>}
          </div>
        </div>
      </div>
    </div>
  );
};
