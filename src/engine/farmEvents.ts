import type { FarmEventsState } from './types';

/** Canonical empty slice. `enabled` defaults true (sim/tests); the UI overrides at run creation. */
export const EMPTY_FARM_EVENTS: FarmEventsState = {
  enabled: true,
  scheduleSeason: 0,
  scheduledDays: [],
  pending: null,
  activeEffects: [],
  contract: null,
  seenIds: [],
  lastResolved: null,
};
