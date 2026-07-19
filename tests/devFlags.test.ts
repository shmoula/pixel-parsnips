import { describe, expect, it } from 'vitest';
import { parseDevFlags, resolveEconomy } from '../src/devFlags';
import { DEFAULT_ECONOMY } from '../src/engine/economy';

describe('parseDevFlags', () => {
  it('parses a comma list in dev mode', () => {
    expect(parseDevFlags('?dev=buildings-s1,foo', true)).toEqual(new Set(['buildings-s1', 'foo']));
  });

  it('returns empty outside dev mode regardless of the URL', () => {
    expect(parseDevFlags('?dev=buildings-s1', false)).toEqual(new Set());
  });

  it('returns empty when the param is absent or blank', () => {
    expect(parseDevFlags('', true)).toEqual(new Set());
    expect(parseDevFlags('?dev=', true)).toEqual(new Set());
  });
});

describe('resolveEconomy', () => {
  it('returns DEFAULT_ECONOMY untouched without the flag', () => {
    expect(resolveEconomy(new Set())).toBe(DEFAULT_ECONOMY);
  });

  it('maps every building to unlockSeason 1 with buildings-s1', () => {
    const eco = resolveEconomy(new Set(['buildings-s1']));
    expect(eco.buildings.definitions.every(d => d.unlockSeason === 1)).toBe(true);
    // and does not mutate the default
    expect(DEFAULT_ECONOMY.buildings.definitions.some(d => d.unlockSeason === 2)).toBe(true);
  });
});
