import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANALYTICS_OPT_OUT_KEY, isOptedOut, isTrackingAllowed, optIn, optOut } from '../../src/analytics/consent';

function setDnt(value: string | null): void {
  Object.defineProperty(window.navigator, 'doNotTrack', { value, configurable: true });
}

beforeEach(() => {
  localStorage.clear();
  setDnt(null);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('consent', () => {
  it('allows tracking by default (no DNT, no opt-out)', () => {
    expect(isTrackingAllowed()).toBe(true);
  });

  it('denies when Do-Not-Track is "1"', () => {
    setDnt('1');
    expect(isTrackingAllowed()).toBe(false);
  });

  it('denies when the opt-out key is set', () => {
    localStorage.setItem(ANALYTICS_OPT_OUT_KEY, 'true');
    expect(isOptedOut()).toBe(true);
    expect(isTrackingAllowed()).toBe(false);
  });

  it('optOut then optIn flips the stored flag', () => {
    optOut();
    expect(isOptedOut()).toBe(true);
    optIn();
    expect(isOptedOut()).toBe(false);
    expect(isTrackingAllowed()).toBe(true);
  });
});
