# Contract: localStorage Schema — 003-crop-disasters

**Key**: `pixel-parsnips-state`
**Schema version**: 3 (bumped from 2)
**Date**: 2026-03-19

---

## Schema format (unchanged wrapper)

```json
{
  "schemaVersion": 3,
  "state": { ...GameState }
}
```

On load, if `schemaVersion !== 3`, the save is discarded and a new game starts.

---

## GameState additions

```jsonc
{
  "schemaVersion": 3,
  "currentDay": 5,
  "coinBalance": 120,
  "flashDroughtDaysRemaining": 0,   // NEW — integer ≥ 0
  "plots": [ ...PlotState[] ],
  "seedInventory": { ... },
  "upgradeTier": 0,
  "lastDailyLog": { ...DailyLogEntry | null },
  "phase": "playing",
  "peakBalance": 120,
  "fertilizerInventory": 0
}
```

---

## PlotState additions

```jsonc
{
  "id": 0,
  "cropId": null,
  "dayPlanted": null,
  "daysRemaining": null,
  "consecutiveHarvests": 0,
  "exhaustedSinceDay": null,
  "pestDamaged": false,         // NEW — boolean, default false
  "droughtPenalised": false     // NEW — boolean, default false
}
```

---

## DailyLogEntry additions

```jsonc
{
  "day": 4,
  "weatherId": "pest_infestation",
  "weatherMultiplier": 1.0,
  "harvests": [],
  "pestDestroyedPlots": [2, 7],     // NEW — number[], [] if no pest event
  "flashDroughtDaysAfter": 0,       // NEW — number (post-turn counter value)
  "totalHarvestIncome": 0,
  "openingBalance": 95,
  "landLeaseDeducted": 15,
  "taxRate": 0.05,
  "taxDeducted": 4,
  "netChange": -19,
  "closingBalance": 76,
  "exhaustedPlots": []
}
```

---

## Migration behaviour

- Saves with `schemaVersion < 3` are discarded on load (`loadState()` in `useGameEngine.ts` returns `initialGameState()`).
- No backwards-compatible migration is attempted (consistent with existing v1→v2 strategy).
- A console info message is logged: `[PixelParsnips] Save data schema upgraded from vN to v3 — starting a new game.`
