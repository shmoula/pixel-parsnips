# G12 — Harvest Streak Counter

**Status:** Design approved · 2026-06-05
**Backlog item:** [G12](../../../backlog.md) — Phase 2 "Give each day a hook" (primary per-day hook after G4 deferral)
**Refs:** p5·3.5
**Effort:** S

---

## Summary

Add a per-day hook that rewards consecutive harvest days. The player builds a streak by harvesting at least one plot per turn; each turn pays an escalating coin bonus that caps at +20. The streak resets when a turn produces no harvest (drought-stalled growth, full pest wipeout, etc.) and at the end of every season. Total run-length of the longest streak is tracked as a persistent personal best.

No penalty — only forgone bonus. The streak is a layer on top of the existing harvest loop, not a new resource to manage.

---

## Goals

- Give every harvesting day a small extra tension layer beyond the season-target arc.
- Reward consistent play (covering plots, staggering growth) without punishing disasters with a penalty.
- Add a persistent personal best in the same shape as 007's existing bests, so it slots into the bankruptcy screen without new infrastructure.

## Non-goals

- No achievements, no narrative events, no streak-related shop items. (Those belong to G14 / G11 / G8.)
- No mid-run notifications, modals, or celebrations at streak milestones beyond the standard Day Summary line.
- No retroactive streak from historical save data — v3 → v4 migrations start streak at 0.

---

## Bonus schedule

| `harvestStreak` | Bonus paid that turn |
|---|---|
| 1 | +5 🪙 |
| 2 | +10 🪙 |
| 3 | +15 🪙 |
| 4+ | +20 🪙 |

Formula: `bonus = min(harvestStreak, 4) * 5`. The cap is on the bonus only — `harvestStreak` itself is uncapped (so the HUD can show `×7` and the per-run peak can be tracked without a second counter).

---

## Data model

### `GameState` additions (schema 3 → 4)

```ts
harvestStreak: number;       // 0–4, drives the bonus
peakHarvestStreak: number;   // uncapped, for personal-best display
```

Initial values: both `0`. Migration from v3 sets both to `0` — no retroactive credit.

### `DailyLogEntry` additions

```ts
streakBefore: number;   // streak value at turn start
streakAfter: number;    // streak value at turn end (post-season-reset if applicable)
streakBonus: number;    // coins awarded this turn (0 if no harvest)
```

`streakBefore` is what makes the "Streak reset" note in the Day Summary self-contained — the renderer compares `streakBefore > 0 && streakAfter === 0`.

### `records.ts` additions

```ts
bestHarvestStreak: number;   // highest peakHarvestStreak across all runs
```

Follows the existing pattern in `records.ts`: own schemaVersion bump, defensive parse, `pixel-parsnips-records` localStorage key. Untouched by Restart, like the other personal bests.

---

## Engine logic (`processTurn`)

Insertion point: between step 4 (harvest income added) and step 5 (bankruptcy check). The bonus counts toward avoiding bankruptcy on the turn it is earned.

`harvestStreak` in `GameState` is the **uncapped** running count of consecutive harvest days. The bonus is computed against the capped value (`min(harvestStreak, 4) * 5`), but the field itself grows freely. The HUD displays the uncapped count — `🔥 Streak ×7` reads naturally; capping the display at 4 would feel artificial.

```text
Step 4.5 — Streak update:
  streakBefore = state.harvestStreak

  if harvests.length > 0:
    newStreak         = state.harvestStreak + 1
    streakBonus       = min(newStreak, 4) * 5            // 5, 10, 15, 20
    coinBalance      += streakBonus
    peakHarvestStreak = max(state.peakHarvestStreak, newStreak)
  else:
    newStreak         = 0
    streakBonus       = 0
    peakHarvestStreak = state.peakHarvestStreak          // peak is run-best, not reset on miss
```

### Season-end reset

In step 8.4, when `seasonPhase` becomes `season_passed` or `season_4_won`, set `harvestStreak = 0` on `nextState`. Do **not** reset on `season_failed` — the run is ending; the final log entry should reflect the streak as it was. Do not reset `peakHarvestStreak` (it's per-run, lives until the next run begins).

### Bankruptcy edge case

If a turn has harvests but `coinBalance + streakBonus` is still below the lease, the bonus is still awarded and recorded in the (final) log entry. The player sees the bonus on the post-mortem summary.

### Log fields

```text
streakBefore  = state.harvestStreak (at turn entry)
streakAfter   = harvestStreak on nextState (post-season-reset if applicable)
streakBonus   = bonus computed above
```

---

## UI

### HUD chip (`HUD.tsx`)

- Render only when `harvestStreak > 0`.
- Position: in the left chip group, after the Day chip, before the Balance chip.
- Markup: a chip in the same pixel-font style as neighbours.
- Content: `🔥 Streak ×N` where N is `state.harvestStreak` (uncapped).
- No animation. Quiet persistent indicator.

### Day Summary / DailyLog (`DailyLog.tsx`)

Two new line types under the harvest income block:

- **Bonus line** — shown when `streakBonus > 0`:
  `🔥 Streak bonus ×N  +N🪙`
  where the `×N` is `streakAfter` (capped at 4) and `+N🪙` is `streakBonus`.

- **Reset line** — shown when `streakBefore > 0 && streakAfter === 0`:
  `🔥 Streak reset` (muted text, no number).

Both lines are skipped when neither condition holds (early-game no-streak turns, or quiet days with no prior streak).

### Bankruptcy screen (`BankruptcyScreen.tsx`)

Add a new row to the personal-bests list (alongside days/peak balance/disasters):

- Label: `Longest streak`
- This-run value: `peakHarvestStreak` from final state
- Previous best: `records.bestHarvestStreak`
- "🏆 New Best!" badge if this-run > previous best (existing pattern from 007)

Records update is written at end-of-run, same lifecycle as the other bests.

---

## Persistence & migration

- `GameState.schemaVersion` bumps 3 → 4.
- v3 → v4 migration: add `harvestStreak: 0`, `peakHarvestStreak: 0`.
- `records.ts` bumps its own schemaVersion (independent of game state) to add `bestHarvestStreak: 0`. Migration is defensive-parse same as existing fields.

---

## Testing

- **Engine — streak increment:** turn with at least one harvest → `harvestStreak` increments, bonus = `min(streak,4)*5`.
- **Engine — streak miss:** turn with zero harvests → `harvestStreak` resets to 0, `peakHarvestStreak` retained.
- **Engine — cap behaviour:** streak at 7 yields bonus of 20, not 35.
- **Engine — peak tracking:** `peakHarvestStreak` records the highest running count; a 12-day streak followed by a miss leaves `peakHarvestStreak` at 12.
- **Engine — season-end reset:** crossing into a new season clears `harvestStreak` to 0 (passing seasons only); peak retained.
- **Engine — bankruptcy with bonus:** bonus is added before the bankruptcy check; a turn that bankrupts still logs the bonus.
- **Engine — bankruptcy without harvest:** no harvest on the bankrupting turn → `streakBonus = 0`, `streakAfter = 0`, `streakBefore` reflects prior streak.
- **Migration — v3 → v4:** loading a v3 save initializes both fields to 0.
- **Records — best update:** finishing a run with `peakHarvestStreak` greater than stored best updates the record; lesser does not.
- **UI — HUD chip:** chip absent when streak is 0, present and correct when streak > 0.
- **UI — DailyLog bonus line:** rendered when `streakBonus > 0`; not when 0.
- **UI — DailyLog reset note:** rendered when `streakBefore > 0 && streakAfter === 0`; not otherwise.
- **UI — BankruptcyScreen new-best badge:** badge shows when this-run peak exceeds previous best.

---

## Out of scope

- Achievements tied to streak milestones (G14).
- Cosmetic effects (flame particles, screen shake) at high streaks.
- Streak-modifier items in the shop.
- Cross-run streak carryover.
- Endless-mode-specific behaviour beyond the existing season-end reset (each Endless pseudo-season resets like a normal season).
