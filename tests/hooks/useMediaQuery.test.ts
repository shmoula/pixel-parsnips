import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery } from '../../src/hooks/useMediaQuery';

function mockMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));
}

/** Mock that exposes the registered `change` listener so tests can flip `matches`. */
function mockMatchMediaWithControl(initial: boolean) {
  const mql = {
    matches: initial,
    media: '',
    listeners: new Set<() => void>(),
    addEventListener: (_: string, cb: () => void) => mql.listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => mql.listeners.delete(cb),
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  };
  vi.stubGlobal('matchMedia', (query: string) => {
    mql.media = query;
    return mql;
  });
  return {
    fire(next: boolean) {
      mql.matches = next;
      mql.listeners.forEach(cb => cb());
    },
  };
}

beforeEach(() => vi.unstubAllGlobals());

describe('useMediaQuery', () => {
  it('returns true when the query matches', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(true);
  });

  it('returns false when the query does not match', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);
  });

  it('updates when the matchMedia change listener fires', () => {
    const ctl = mockMatchMediaWithControl(false);
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);
    act(() => ctl.fire(true));
    expect(result.current).toBe(true);
  });
});
