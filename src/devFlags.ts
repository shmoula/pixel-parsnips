import { DEFAULT_ECONOMY, type EconomyConfig } from './engine/economy';

/**
 * Dev-only feature switches parsed from `?dev=flag1,flag2`.
 * `parseDevFlags` is the pure core (unit-testable); `getDevFlags` binds it to the
 * real URL and build mode. Production builds always see an empty set.
 */
export function parseDevFlags(search: string, isDev: boolean): Set<string> {
  if (!isDev) return new Set();
  const raw = new URLSearchParams(search).get('dev') ?? '';
  return new Set(raw.split(',').map(f => f.trim()).filter(Boolean));
}

export function getDevFlags(): Set<string> {
  return parseDevFlags(
    typeof location !== 'undefined' ? location.search : '',
    import.meta.env.DEV,
  );
}

/** The economy the UI runs on: DEFAULT_ECONOMY unless a dev flag overrides it.
 *  `buildings-s1` unlocks every building in season 1 for manual playtesting. */
export function resolveEconomy(flags: Set<string> = getDevFlags()): EconomyConfig {
  if (!flags.has('buildings-s1')) return DEFAULT_ECONOMY;
  return {
    ...DEFAULT_ECONOMY,
    buildings: {
      ...DEFAULT_ECONOMY.buildings,
      definitions: DEFAULT_ECONOMY.buildings.definitions.map(d => ({ ...d, unlockSeason: 1 })),
    },
  };
}
