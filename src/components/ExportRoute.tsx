import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExportView } from './ExportView';
import { RequireAuth } from './RequireAuth';
import { SOURCES } from '../connectors';
import { SERVICE_META } from '../serviceMeta';
import type { ServiceAuth } from '../serviceMeta';
import type { ServiceId } from '../types';

interface ExportRouteProps {
  authByService: Record<ServiceId, ServiceAuth>;
  redirectUri: string;
}

export const ExportRoute: React.FC<ExportRouteProps> = ({ authByService, redirectUri }) => {
  const [searchParams] = useSearchParams();
  const service: ServiceId = searchParams.get('type') === 'youtube' ? 'youtube' : 'spotify';
  const meta = SERVICE_META[service];
  const auth = authByService[service];
  const source = SOURCES[service];

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
      <ExportView source={source} apiRequest={auth.apiRequest} currentUserId={auth.user?.id ?? null} />
    </RequireAuth>
  );
};
