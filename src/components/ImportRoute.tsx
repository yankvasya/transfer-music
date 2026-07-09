import React from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TrackInput } from './TrackInput';
import { RequireAuth } from './RequireAuth';
import { SERVICE_META } from '../serviceMeta';
import type { ServiceAuth } from '../serviceMeta';
import { resolveService } from '../utils/resolveService';
import type { ServiceId } from '../types';
import type { ParsedTrack } from '../utils/parser';

interface ImportRouteProps {
  authByService: Record<ServiceId, ServiceAuth>;
  renderLoginUI: (service: ServiceId) => ReactNode;
  rawText: string;
  onNext: (tracks: ParsedTrack[], text: string, service: ServiceId) => void;
}

export const ImportRoute: React.FC<ImportRouteProps> = ({ authByService, renderLoginUI, rawText, onNext }) => {
  const [searchParams] = useSearchParams();
  const service = resolveService(searchParams);
  const meta = SERVICE_META[service];
  const auth = authByService[service];

  return (
    <RequireAuth isAuthenticated={auth.isAuthenticated} isLoading={auth.isLoading} serviceName={meta.name} loginUI={renderLoginUI(service)}>
      <TrackInput initialText={rawText} onNext={(tracks, text) => onNext(tracks, text, service)} />
    </RequireAuth>
  );
};
