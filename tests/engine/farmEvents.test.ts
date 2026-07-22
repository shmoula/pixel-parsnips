import { describe, it, expect } from 'vitest';
import { EMPTY_FARM_EVENTS, ensureSchedule, maybeFireEvent, isContractEvent } from '../../src/engine/farmEvents';
import { DEFAULT_ECONOMY } from '../../src/engine/economy';
import type { FarmEventsState, ContractState } from '../../src/engine/types';

/** Deterministic RNG yielding the given sequence, then repeating the last value. */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe('ensureSchedule', () => {
  it('draws 1 event when the second-event roll misses', () => {
    // rolls: secondEventChance miss (0.9), day pick 0.0 → earliest window day
    const fe = ensureSchedule(EMPTY_FARM_EVENTS, 1, DEFAULT_ECONOMY, seq([0.9, 0.0]));
    expect(fe.scheduleSeason).toBe(1);
    expect(fe.scheduledDays).toEqual([5]); // startDay 1 + windowStartOffset 4
  });

  it('draws 2 distinct days when the second-event roll hits', () => {
    // rolls: hit (0.1), then two identical day picks — linear probe makes them distinct
    const fe = ensureSchedule(EMPTY_FARM_EVENTS, 1, DEFAULT_ECONOMY, seq([0.1, 0.5, 0.5]));
    expect(fe.scheduledDays).toHaveLength(2);
    expect(new Set(fe.scheduledDays).size).toBe(2);
    for (const d of fe.scheduledDays) {
      expect(d).toBeGreaterThanOrEqual(5);
      expect(d).toBeLessThanOrEqual(16); // startDay 1 + windowEndOffset 15
    }
  });

  it('is a no-op when the season schedule is already drawn', () => {
    const drawn = ensureSchedule(EMPTY_FARM_EVENTS, 1, DEFAULT_ECONOMY, seq([0.9, 0.0]));
    const again = ensureSchedule(drawn, 7, DEFAULT_ECONOMY, seq([0.1, 0.9]));
    expect(again).toBe(drawn);
  });

  it('redraws when the day crosses into a new season', () => {
    const s1 = ensureSchedule(EMPTY_FARM_EVENTS, 1, DEFAULT_ECONOMY, seq([0.9, 0.0]));
    const s2 = ensureSchedule(s1, 21, DEFAULT_ECONOMY, seq([0.9, 0.0]));
    expect(s2.scheduleSeason).toBe(2);
    expect(s2.scheduledDays).toEqual([25]); // startDay 21 + 4
  });

  it('clamps a mid-season draw to future days only', () => {
    // Migrated save on day 10: window lo = max(5, 10+1) = 11
    const fe = ensureSchedule(EMPTY_FARM_EVENTS, 10, DEFAULT_ECONOMY, seq([0.9, 0.0]));
    expect(fe.scheduledDays).toEqual([11]);
  });

  it('produces an empty schedule when the remaining window is empty', () => {
    // Day 17 of season 1: lo = 18 > hi = 16 → no events this season
    const fe = ensureSchedule(EMPTY_FARM_EVENTS, 17, DEFAULT_ECONOMY, seq([0.1, 0.5]));
    expect(fe.scheduleSeason).toBe(1);
    expect(fe.scheduledDays).toEqual([]);
  });

  it('does nothing while disabled', () => {
    const disabled = { ...EMPTY_FARM_EVENTS, enabled: false };
    expect(ensureSchedule(disabled, 1, DEFAULT_ECONOMY, seq([0.1]))).toBe(disabled);
  });

  it('schedules for endless seasons too', () => {
    const fe = ensureSchedule(EMPTY_FARM_EVENTS, 81, DEFAULT_ECONOMY, seq([0.9, 0.0]));
    expect(fe.scheduleSeason).toBe(5);
    expect(fe.scheduledDays).toEqual([85]); // endless season 5 startDay 81 + 4
  });
});

const scheduledFe = (days: number[], extra: Partial<FarmEventsState> = {}): FarmEventsState => ({
  ...EMPTY_FARM_EVENTS, scheduleSeason: 1, scheduledDays: days, ...extra,
});

describe('maybeFireEvent', () => {
  it('sets pending on a scheduled day and marks the id seen', () => {
    const fe = maybeFireEvent(scheduledFe([8]), 8, DEFAULT_ECONOMY, seq([0.0]));
    expect(fe.pending).toEqual({ eventId: 'traveling_merchant', firedDay: 8 });
    expect(fe.seenIds).toContain('traveling_merchant');
  });

  it('does nothing off-schedule, while pending, or while disabled', () => {
    const base = scheduledFe([8]);
    expect(maybeFireEvent(base, 9, DEFAULT_ECONOMY, seq([0.0]))).toBe(base);
    const pending = scheduledFe([8], { pending: { eventId: 'bountiful_spring', firedDay: 6 } });
    expect(maybeFireEvent(pending, 8, DEFAULT_ECONOMY, seq([0.0]))).toBe(pending);
    const disabled = scheduledFe([8], { enabled: false });
    expect(maybeFireEvent(disabled, 8, DEFAULT_ECONOMY, seq([0.0]))).toBe(disabled);
  });

  it('never repeats a seen event until the pool is exhausted, then resets the pool', () => {
    const allSeen = scheduledFe([8], {
      seenIds: ['traveling_merchant', 'bountiful_spring', 'drought_warning',
                'millers_order', 'fair_committee', 'wandering_beekeeper'],
    });
    const fe = maybeFireEvent(allSeen, 8, DEFAULT_ECONOMY, seq([0.0]));
    expect(fe.pending?.eventId).toBe('traveling_merchant'); // pool reset, full catalog again
    expect(fe.seenIds).toEqual(['traveling_merchant']);
  });

  it('excludes contract events while a contract is live', () => {
    const contract: ContractState = {
      eventId: 'millers_order', cropId: 'parsnip', quantity: 3, remaining: 2, deadlineDay: 12, reward: 55,
    };
    const fe = maybeFireEvent(scheduledFe([8], { contract }), 8, DEFAULT_ECONOMY, seq([0.99]));
    expect(fe.pending).not.toBeNull();
    const def = DEFAULT_ECONOMY.farmEvents.events.find(e => e.id === fe.pending!.eventId)!;
    expect(isContractEvent(def)).toBe(false);
  });

  it('applies the drought pin at fire time when the pre-roll hits', () => {
    // Force drought_warning: seenIds excludes everything else.
    const others = scheduledFe([8], {
      seenIds: ['traveling_merchant', 'bountiful_spring', 'millers_order', 'fair_committee', 'wandering_beekeeper'],
    });
    // rng: candidate pick (only 1 candidate → any), pin chance hit (0.1 < 0.7), offset pick 0.99 → max offset 3
    const fe = maybeFireEvent(others, 8, DEFAULT_ECONOMY, seq([0.0, 0.1, 0.99]));
    expect(fe.pending?.eventId).toBe('drought_warning');
    expect(fe.activeEffects).toEqual([{ kind: 'weather_pin', weatherId: 'flash_drought', day: 11 }]);
  });

  it('skips the pin when the pre-roll misses', () => {
    const others = scheduledFe([8], {
      seenIds: ['traveling_merchant', 'bountiful_spring', 'millers_order', 'fair_committee', 'wandering_beekeeper'],
    });
    const fe = maybeFireEvent(others, 8, DEFAULT_ECONOMY, seq([0.0, 0.9]));
    expect(fe.pending?.eventId).toBe('drought_warning');
    expect(fe.activeEffects).toEqual([]);
  });
});
