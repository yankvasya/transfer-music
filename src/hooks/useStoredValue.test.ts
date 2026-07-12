import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useStoredValue } from './useStoredValue';

describe('useStoredValue', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes from localStorage, falling back to the env value, then empty', () => {
    localStorage.setItem('k1', 'stored');
    expect(renderHook(() => useStoredValue('k1', 'env-default')).result.current[0]).toBe('stored');
    expect(renderHook(() => useStoredValue('k2', 'env-default')).result.current[0]).toBe('env-default');
    expect(renderHook(() => useStoredValue('k3')).result.current[0]).toBe('');
  });

  it('persists a new value and removes the key when cleared', () => {
    const { result } = renderHook(() => useStoredValue('client_id'));

    act(() => result.current[1]('abc123'));
    expect(result.current[0]).toBe('abc123');
    expect(localStorage.getItem('client_id')).toBe('abc123');

    act(() => result.current[1](''));
    expect(result.current[0]).toBe('');
    expect(localStorage.getItem('client_id')).toBeNull();
  });
});
