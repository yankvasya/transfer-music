import React from 'react';
import { useSearchParams, Navigate, useNavigate } from 'react-router-dom';
import { PlaylistSetup } from './PlaylistSetup';
import { RequireAuth } from './RequireAuth';
import { SOURCES } from '../connectors';
import { SERVICE_META } from '../serviceMeta';
import type { ServiceAuth } from '../serviceMeta';
import type { ServiceId } from '../types';
import type { ParsedTrack } from '../utils/parser';

interface PlaylistRouteProps {
  authByService: Record<ServiceId, ServiceAuth>;
  redirectUri: string;
  tracks: ParsedTrack[];
  onStart: (name: string, description: string, isPublic: boolean, service: ServiceId) => void;
}

export const PlaylistRoute: React.FC<PlaylistRouteProps> = ({ authByService, redirectUri, tracks, onStart }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const service: ServiceId = searchParams.get('type') === 'youtube' ? 'youtube' : 'spotify';
  const meta = SERVICE_META[service];
  const auth = authByService[service];

  if (tracks.length === 0) {
    return <Navigate to={`/import?type=${service}`} replace />;
  }

  return (
    <RequireAuth
      auth={auth}
      serviceName={meta.name}
      helpText={meta.helpText}
      loginDescription={meta.loginDescription}
      loginIcon={meta.icon}
      loginButtonClass={meta.buttonClass}
      redirectUri={redirectUri}
    >
      <PlaylistSetup
        trackCount={tracks.length}
        apiRequest={auth.apiRequest}
        source={SOURCES[service]}
        currentUserId={auth.user?.id ?? null}
        onBack={() => navigate(`/import?type=${service}`)}
        onStart={(name, description, isPublic) => onStart(name, description, isPublic, service)}
      />
    </RequireAuth>
  );
};
