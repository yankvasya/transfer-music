import type { ServiceId } from '../types';

const KNOWN_SERVICES: ServiceId[] = ['spotify', 'youtube', 'yandex-music', 'deezer'];

export function resolveService(searchParams: URLSearchParams, paramName: string = 'type'): ServiceId {
  const value = searchParams.get(paramName);
  return (KNOWN_SERVICES as string[]).includes(value ?? '') ? (value as ServiceId) : 'spotify';
}
