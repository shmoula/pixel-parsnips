import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimatedNumber } from '../../src/hooks/useAnimatedNumber';

function stubReducedMotion(matches: boolean) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

beforeEach(() => {
  stubReducedMotion(false);
  // rAF + performance must both be faked so frame timestamps advance together.
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useAnimatedNumber', () => {
  it('renders the target immediately when animate is false', () => {
    const { result, rerender } = renderHook(
      ({ target }) => useAnimatedNumber(target, false, 800),
      { initialProps: { target: 100 } },
    );
    expect(result.current).toBe(100);
    rerender({ target: 250 });
    expect(result.current).toBe(250);
  });

  it('ticks toward the target over the duration when animate is true', () => {
    const { result, rerender } = renderHook(
      ({ target, animate }) => useAnimatedNumber(target, animate, 800),
      { initialProps: { target: 100, animate: false } },
    );
    rerender({ target: 200, animate: true });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current).toBeGreaterThan(100);
    expect(result.current).toBeLessThan(200);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current).toBe(200);
  });

  it('retargets mid-flight from the currently displayed value', () => {
    const { result, rerender } = renderHook(
      ({ target, animate }) => useAnimatedNumber(target, animate, 800),
      { initialProps: { target: 0, animate: false } },
    );
    rerender({ target: 100, animate: true });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    const midway = result.current;
    expect(midway).toBeGreaterThan(0);
    rerender({ target: 500, animate: true });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(500);
  });

  it('snaps to the target under prefers-reduced-motion even when animate is true', () => {
    stubReducedMotion(true);
    const { result, rerender } = renderHook(
      ({ target, animate }) => useAnimatedNumber(target, animate, 800),
      { initialProps: { target: 100, animate: true } },
    );
    rerender({ target: 900, animate: true });
    expect(result.current).toBe(900);
  });
});
