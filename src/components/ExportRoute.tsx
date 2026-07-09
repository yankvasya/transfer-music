import React from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExportView } from './ExportView';
import { RequireAuth } from './RequireAuth';
import { SOURCES } from '../connectors';
import { SERVICE_META } from '../serviceMeta';
import type { ServiceAuth } from '../serviceMeta';
import { resolveService } from '../utils/resolveService';
import type { ServiceId } from '../types';

interface ExportRouteProps {
  authByService: Record<ServiceId, ServiceAuth>;
  renderLoginUI: (service: ServiceId) => ReactNode;
}

export const ExportRoute: React.FC<ExportRouteProps> = ({ authByService, renderLoginUI }) => {
  const [searchParams] = useSearchParams();
  const service = resolveService(searchParams);
  const meta = SERVICE_META[service];
  const auth = authByService[service];
  const source = SOURCES[service];

  return (
    <RequireAuth isAuthenticated={auth.isAuthenticated} isLoading={auth.isLoading} serviceName={meta.name} loginUI={renderLoginUI(service)}>
      <ExportView source={source} apiRequest={auth.apiRequest} currentUserId={auth.user?.id ?? null} />
    </RequireAuth>
  );
};
