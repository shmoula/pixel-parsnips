import { beforeEach, describe, expect, it } from 'vitest';
import {
  ANALYTICS_ID_KEY,
  getDeviceType,
  getOrCreatePlayerId,
  hasSavedRun,
  parseUtms,
} from '../../src/analytics/globals';

beforeEach(() => {
  localStorage.clear();
});

describe('getOrCreatePlayerId', () => {
  it('creates and persists a new id, reporting a first-time player', () => {
    const first = getOrCreatePlayerId();
    expect(first.isReturning).toBe(false);
    expect(first.id).toMatch(/.{8,}/);
    expect(localStorage.getItem(ANALYTICS_ID_KEY)).toBe(first.id);
  });

  it('reuses the persisted id, reporting a returning player', () => {
    const first = getOrCreatePlayerId();
    const second = getOrCreatePlayerId();
    expect(second.id).toBe(first.id);
    expect(second.isReturning).toBe(true);
  });
});

describe('hasSavedRun', () => {
  it('is true only when the game save key exists', () => {
    expect(hasSavedRun()).toBe(false);
    localStorage.setItem('pixel-parsnips-state', '{}');
    expect(hasSavedRun()).toBe(true);
  });
});

describe('parseUtms', () => {
  it('extracts only utm_* params', () => {
    expect(parseUtms('?utm_source=reddit&utm_medium=social&foo=bar')).toEqual({
      utm_source: 'reddit',
      utm_medium: 'social',
    });
  });

  it('returns an empty object when there are no utm params', () => {
    expect(parseUtms('?foo=bar')).toEqual({});
  });
});

describe('getDeviceType', () => {
  it('defaults to desktop under the jsdom matchMedia stub', () => {
    expect(getDeviceType()).toBe('desktop');
  });
});
