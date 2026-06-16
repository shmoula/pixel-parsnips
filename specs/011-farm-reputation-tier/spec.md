# 011 — Farm Reputation Tier (G13)

> Status: **Spec** · Priority: Low · Effort: S · Source: p5·3.3, backlog G13
> Created: 2026-06-16

## Summary

A cosmetic HUD title ("Reputation Tier") that escalates with the **current run's**
`currentDay`. Pure display — no mechanical effect, no persistence, no schema bump.
The title resets implicitly on every new run because it is derived live from
`currentDay`; there is no stored reputation state.

This delivers p5·3.3's "named progress within a run": giving Day 14 a different
identity from Day 4 via an endowed-progress ladder of titles.

## Goals

- Give the player a sense of "where am I in this run" beyond the raw day counter.
- Front-load tier-ups in the early game so progress feels frequent at the start.
- Layer cleanly on top of existing systems with zero new state and zero risk to
  saves, the economy, or the season/medal logic.

## Non-Goals (YAGNI)

- No career / persistent rank across runs (no `records.ts` wiring).
- No tier-up animation, toast, or celebration moment.
- No mechanical effect of any kind (no bonuses, gates, or penalties).
- No changes to the medal system, season system, or economy.

## Decisions (from brainstorming, 2026-06-16)

1. **Basis: current-run progress.** Title escalates with this run's `currentDay`
   and resets to Tier 1 on a new run. No dependency on `records.ts`.
2. **Cadence: day-based, front-loaded.** Frequent tier-ups early (4 tiers inside
   Season 1), sparser later, plus a top tier for Endless (day 81+).
3. **Placement: new dedicated chip** in the HUD's left cluster, styled like the
   existing harvest-streak chip.

## Reputation Ladder

`getReputationTier(currentDay)` maps any `day ≥ 1` to exactly one tier:

| Tier | Days  | Title                 |
|------|-------|-----------------------|
| 1    | 1–3   | Struggling Smallholder |
| 2    | 4–7   | Hopeful Homesteader    |
| 3    | 8–13  | Apprentice Farmer      |
| 4    | 14–20 | Seasoned Grower        |
| 5    | 21–40 | Respected Agronomist   |
| 6    | 41–80 | Master of the Harvest  |
| 7    | 81+   | Legendary Cultivator   |

Notes:
- Tiers 1–5 keep p5·3.3's original titles; Tier 2 ("Hopeful Homesteader") is added
  to front-load Season 1 (days 1–20 now yield four tier-ups: at days 1, 4, 8, 14).
- Tier 7 ("Legendary Cultivator") rewards breaking into Endless mode (day 81+).
- The top tier is open-ended, so arbitrarily large day values are total/safe.

## Architecture

### New module: `src/engine/reputation.ts`

Mirrors the shape of [`medals.ts`](../../src/engine/medals.ts): a small table plus a
pure, total derivation function. No state, no `localStorage`, no side effects.

```ts
export interface ReputationTier {
  /** 1-based tier index, matching the ladder table. */
  tier: number;
  /** Display title shown in the HUD. */
  title: string;
  /** First day (inclusive) at which this tier applies. */
  minDay: number;
}

/** Ladder ordered ascending by minDay; the last entry is open-ended. */
export const REPUTATION_TIERS: readonly ReputationTier[];

/**
 * Returns the reputation tier for the given run day.
 * Total over day ≥ 1: every day maps to exactly one tier; days beyond the
 * last threshold return the top tier. Pure — no I/O.
 */
export function getReputationTier(currentDay: number): ReputationTier;
```

Implementation: pick the highest-`minDay` tier whose `minDay <= currentDay`
(equivalently, the last tier in the table not exceeding `currentDay`). Defensive
behavior for `currentDay < 1` returns Tier 1 (the floor) rather than throwing.

### HUD chip: `src/components/HUD.tsx`

`HUD` already receives `currentDay` and already derives `season` from it via
`getSeasonForDay(currentDay)`. The reputation chip follows the same pattern:
compute `getReputationTier(currentDay)` inline — **no new prop, no `GameBoard`
change.**

A new dedicated chip is added to the left cluster (alongside the Season, Balance,
and Streak chips), styled consistently with the existing harvest-streak chip:

- Icon: 🎖️ (decorative, `aria-hidden`).
- Title text in the chip's pixel font.
- `aria-label` such as `Reputation: Seasoned Grower`.
- Always visible (unlike the streak chip, which hides at 0) — Tier 1 shows from
  Day 1.

### Data flow

`currentDay` → `getReputationTier` → chip text. One direction, no writes, no new
state anywhere.

## Error Handling

`getReputationTier` is total: every `day ≥ 1` maps to exactly one tier, and the
top tier is open-ended, so out-of-range or very large days cannot break rendering.
`day < 1` (not expected in normal play) returns Tier 1.

## Testing

### `tests/engine/reputation.test.ts`

- Boundary days return the correct title: 1, 3, 4, 7, 8, 13, 14, 20, 21, 40, 41,
  80, 81.
- A large Endless day (e.g. 500) returns Tier 7.
- Defensive: `day < 1` returns Tier 1; the function never throws.
- Total coverage: `REPUTATION_TIERS` is contiguous and ascending (no gaps/overlaps).

### `tests/components/HUD.test.tsx` (extend)

- The reputation chip renders the expected title for a representative day.
- The chip exposes its `aria-label`.

## Verification

- `npm test && npm run lint` pass.
- Manual: chip shows "Struggling Smallholder" on Day 1 and updates at each
  threshold as days advance.

## Risk / Impact

- **Saves:** none — no persisted state, no schema change.
- **Economy/balance:** none — purely cosmetic; no `npm run sim` impact.
- **Layout:** the HUD header already uses `flex-wrap`; the extra chip may wrap to a
  second line on narrow viewports, which is acceptable and consistent with the
  existing responsive behavior.
