import type { ServiceId } from '../types';
import type { DestinationConnector, SourceConnector } from './types';
import { spotifyDestination, spotifySource } from './spotify';
import { youtubeDestination, youtubeSource } from './youtube';

export const DESTINATIONS: Record<ServiceId, DestinationConnector> = {
  spotify: spotifyDestination,
  youtube: youtubeDestination,
};

export const SOURCES: Record<ServiceId, SourceConnector> = {
  spotify: spotifySource,
  youtube: youtubeSource,
};

export type { DestinationConnector, SourceConnector, PlaylistSummary } from './types';
