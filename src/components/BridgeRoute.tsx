import React from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BridgeTransfer } from './BridgeTransfer';
import { RequireAuth } from './RequireAuth';
import { SOURCES } from '../connectors';
import { SERVICE_META } from '../serviceMeta';
import type { ServiceAuth } from '../serviceMeta';
import { resolveService } from '../utils/resolveService';
import type { ServiceId } from '../types';

interface BridgeRouteProps {
  authByService: Record<ServiceId, ServiceAuth>;
  renderLoginUI: (service: ServiceId) => ReactNode;
}

// Gates a direct service-to-service transfer behind BOTH services' auth — source first
// (to read from), then destination (to write to) — nesting RequireAuth twice rather than
// widening it to handle multiple services, since every other route only ever needs one.
export const BridgeRoute: React.FC<BridgeRouteProps> = ({ authByService, renderLoginUI }) => {
  const [searchParams] = useSearchParams();
  const from = resolveService(searchParams, 'from');
  const to = resolveService(searchParams, 'to');

  const fromAuth = authByService[from];
  const toAuth = authByService[to];

  return (
    <RequireAuth
      isAuthenticated={fromAuth.isAuthenticated}
      isLoading={fromAuth.isLoading}
      serviceName={SERVICE_META[from].name}
      loginUI={renderLoginUI(from)}
    >
      <RequireAuth
        isAuthenticated={toAuth.isAuthenticated}
        isLoading={toAuth.isLoading}
        serviceName={SERVICE_META[to].name}
        loginUI={renderLoginUI(to)}
      >
        <BridgeTransfer
          from={from}
          to={to}
          source={SOURCES[from]}
          sourceApiRequest={fromAuth.apiRequest}
          sourceCurrentUserId={fromAuth.user?.id ?? null}
        />
      </RequireAuth>
    </RequireAuth>
  );
};
