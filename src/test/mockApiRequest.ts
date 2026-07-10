import { vi } from 'vitest';

export interface MockCall {
  endpoint: string;
  options?: RequestInit;
}

// A minimal stand-in for the real apiRequest wrapper each service's hook provides:
// records every call so tests can assert on exact endpoints/bodies, and delegates the
// actual response to a handler the test controls.
export function createMockApiRequest(handler: (endpoint: string, options: RequestInit | undefined, callIndex: number) => any) {
  const calls: MockCall[] = [];
  const apiRequest = vi.fn(async (endpoint: string, options?: RequestInit) => {
    const callIndex = calls.length;
    calls.push({ endpoint, options });
    return handler(endpoint, options, callIndex);
  });
  return { apiRequest, calls };
}

export function makeTrack(raw: string, artist: string, title: string) {
  return { raw, artist, title, isValid: true };
}
