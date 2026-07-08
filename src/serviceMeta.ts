import type { ServiceId } from './types';

export interface ServiceAuth {
  clientId: string;
  setClientId: (id: string) => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  user: { id: string; display_name: string; images: { url: string }[] } | null;
  logout: () => void;
  apiRequest: (endpoint: string, options?: RequestInit) => Promise<any>;
}

interface ServiceMeta {
  name: string;
  helpText: string;
  loginDescription: string;
  icon: string;
  buttonClass: string;
}

export const SERVICE_META: Record<ServiceId, ServiceMeta> = {
  spotify: {
    name: 'Spotify',
    helpText: 'To use client-side authentication, you need to create a Spotify Developer App and get a Client ID.',
    loginDescription: 'Log in with your Spotify account to authorize creating playlists and importing your tracks.',
    icon: '🟢',
    buttonClass: 'btn-spotify',
  },
  youtube: {
    name: 'YouTube',
    helpText:
      'To use client-side authentication, create a Google Cloud project, enable the "YouTube Data API v3", and create an OAuth Client ID of type "Web application".',
    loginDescription: 'Log in with your Google account to authorize creating YouTube playlists and importing videos.',
    icon: '▶️',
    buttonClass: 'btn-youtube',
  },
};
