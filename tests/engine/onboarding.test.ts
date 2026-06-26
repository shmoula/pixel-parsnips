import { describe, it, expect, beforeEach } from 'vitest';
import {
  ONBOARDING_KEY,
  loadOnboarding,
  saveOnboarding,
  markOnboardingComplete,
  requestOnboardingReplay,
  type OnboardingRecord,
} from '../../src/engine/onboarding';

beforeEach(() => localStorage.clear());

describe('loadOnboarding', () => {
  it('defaults to not-completed at the welcome step when absent', () => {
    expect(loadOnboarding()).toEqual({ schemaVersion: 1, completed: false, step: 'welcome' });
  });

  it('returns defaults (never throws) on malformed JSON', () => {
    localStorage.setItem(ONBOARDING_KEY, '{not json');
    expect(loadOnboarding()).toEqual({ schemaVersion: 1, completed: false, step: 'welcome' });
  });

  it('round-trips a saved record', () => {
    const rec: OnboardingRecord = { schemaVersion: 1, completed: false, step: 'plant' };
    saveOnboarding(rec);
    expect(loadOnboarding()).toEqual(rec);
  });

  it('coerces a bad step back to welcome', () => {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ schemaVersion: 1, completed: false, step: 'bogus' }));
    expect(loadOnboarding().step).toBe('welcome');
  });
});

describe('markOnboardingComplete', () => {
  it('sets completed and step=done', () => {
    markOnboardingComplete();
    expect(loadOnboarding()).toEqual({ schemaVersion: 1, completed: true, step: 'done' });
  });
});

describe('requestOnboardingReplay', () => {
  it('resets to a fresh, not-completed welcome record', () => {
    markOnboardingComplete();
    requestOnboardingReplay();
    expect(loadOnboarding()).toEqual({ schemaVersion: 1, completed: false, step: 'welcome' });
  });
});
