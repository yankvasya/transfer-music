import type { ServiceId } from '../types';

const KNOWN_SERVICES: ServiceId[] = ['spotify', 'youtube', 'yandex-music'];

export function resolveService(searchParams: URLSearchParams): ServiceId {
  const type = searchParams.get('type');
  return (KNOWN_SERVICES as string[]).includes(type ?? '') ? (type as ServiceId) : 'spotify';
}
