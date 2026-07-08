import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { TrackInput } from './TrackInput';
import { RequireAuth } from './RequireAuth';
import { SERVICE_META } from '../serviceMeta';
import type { ServiceAuth } from '../serviceMeta';
import type { ServiceId } from '../types';
import type { ParsedTrack } from '../utils/parser';

interface ImportRouteProps {
  authByService: Record<ServiceId, ServiceAuth>;
  redirectUri: string;
  rawText: string;
  onNext: (tracks: ParsedTrack[], text: string, service: ServiceId) => void;
}

export const ImportRoute: React.FC<ImportRouteProps> = ({ authByService, redirectUri, rawText, onNext }) => {
  const [searchParams] = useSearchParams();
  const service: ServiceId = searchParams.get('type') === 'youtube' ? 'youtube' : 'spotify';
  const meta = SERVICE_META[service];
  const auth = authByService[service];

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
      <TrackInput initialText={rawText} onNext={(tracks, text) => onNext(tracks, text, service)} />
    </RequireAuth>
  );
};
