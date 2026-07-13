import type { ServiceId } from './types';

// The common subset every service's auth hook exposes, regardless of how it actually
// authenticates (redirect-based OAuth PKCE for Spotify/YouTube, device flow for
// Yandex). Route wrappers only ever need this much to decide whether to render
// children or a login screen — the service-specific login UI is built separately
// (see OAuthLoginUI / YandexDeviceLogin) since the two flows need different props.
export interface ServiceAuth {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: { id: string; display_name: string; images: { url: string }[] } | null;
  logout: () => void;
  apiRequest: (endpoint: string, options?: RequestInit) => Promise<any>;
}

interface ServiceMeta {
  name: string;
  icon: string;
  buttonClass: string;
  loginDescription: string;
}

export const SERVICE_META: Record<ServiceId, ServiceMeta> = {
  spotify: {
    name: 'Spotify',
    icon: '🟢',
    buttonClass: 'btn-spotify',
    loginDescription: 'Log in with your Spotify account to authorize creating playlists and importing your tracks.',
  },
  youtube: {
    name: 'YouTube',
    icon: '▶️',
    buttonClass: 'btn-youtube',
    loginDescription: 'Log in with your Google account to authorize creating YouTube playlists and importing videos.',
  },
  'yandex-music': {
    name: 'Yandex Music',
    icon: '🎵',
    buttonClass: 'btn-yandex',
    // loginDescription/buttonClass are unused by its actual login UI (YandexDeviceLogin)
    // but kept for a complete Record.
    loginDescription: '',
  },
  deezer: {
    name: 'Deezer',
    icon: '🎶',
    buttonClass: 'btn-deezer',
    // loginDescription is unused by DeezerLoginUI (which has its own copy) but kept for
    // a complete Record.
    loginDescription: '',
  },
};
