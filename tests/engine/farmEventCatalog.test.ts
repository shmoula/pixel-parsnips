import { describe, it, expect } from 'vitest';
import { FARM_EVENT_DEFINITIONS } from '../../src/engine/farmEventCatalog';

describe('farm event catalog', () => {
  it('ships exactly the six v1 events with unique ids', () => {
    const ids = FARM_EVENT_DEFINITIONS.map(e => e.id);
    expect(ids).toEqual([
      'traveling_merchant', 'bountiful_spring', 'drought_warning',
      'millers_order', 'fair_committee', 'wandering_beekeeper',
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('choice B is always the safe side: no negative coins, no contract, no buff downside', () => {
    for (const def of FARM_EVENT_DEFINITIONS) {
      for (const e of def.choiceB.effects) {
        expect(e.kind).toBe('coins_delta');
        if (e.kind === 'coins_delta') expect(e.amount).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('every event has copy for title, body, and both choice labels/summaries', () => {
    for (const def of FARM_EVENT_DEFINITIONS) {
      expect(def.title.length).toBeGreaterThan(0);
      expect(def.body.length).toBeGreaterThan(0);
      for (const c of [def.choiceA, def.choiceB]) {
        expect(c.label.length).toBeGreaterThan(0);
        expect(c.summary.length).toBeGreaterThan(0);
      }
    }
  });

  it('only drought_warning carries fire-time effects, and they are weather pins', () => {
    for (const def of FARM_EVENT_DEFINITIONS) {
      if (def.id === 'drought_warning') {
        expect(def.onFire).toHaveLength(1);
        expect(def.onFire![0].kind).toBe('weather_pin');
      } else {
        expect(def.onFire).toBeUndefined();
      }
    }
  });
});
