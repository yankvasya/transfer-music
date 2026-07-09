import type { ServiceId } from '../types';
import type { DestinationConnector, SourceConnector } from './types';
import { spotifyDestination, spotifySource } from './spotify';
import { youtubeDestination, youtubeSource } from './youtube';
import { yandexDestination, yandexSource } from './yandex';
import { deezerDestination, deezerSource } from './deezer';

export const DESTINATIONS: Record<ServiceId, DestinationConnector> = {
  spotify: spotifyDestination,
  youtube: youtubeDestination,
  'yandex-music': yandexDestination,
  deezer: deezerDestination,
};

export const SOURCES: Record<ServiceId, SourceConnector> = {
  spotify: spotifySource,
  youtube: youtubeSource,
  'yandex-music': yandexSource,
  deezer: deezerSource,
};

export type { DestinationConnector, SourceConnector, PlaylistSummary } from './types';
