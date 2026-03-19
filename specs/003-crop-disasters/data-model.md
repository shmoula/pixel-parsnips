# Data Model: 003-crop-disasters

**Branch**: `003-crop-disasters` | **Date**: 2026-03-19

All changes are additive to existing types in `src/engine/types.ts` and scalar constants in `src/engine/constants.ts`. No existing fields are removed or renamed.

---

## 1. WeatherId (extended union type)

**File**: `src/engine/types.ts`

```ts
// Before (5 members)
export type WeatherId =
  | 'drought' | 'overcast' | 'sunny' | 'warm_breeze' | 'perfect_sun';

// After (8 members — 3 disaster events added)
export type WeatherId =
  | 'drought' | 'overcast' | 'sunny' | 'warm_breeze' | 'perfect_sun'
  | 'blight' | 'pest_infestation' | 'flash_drought';
```

**Constraint**: `WeatherDefinition.multiplier` for `pest_infestation` and `flash_drought` is `1.0` (no harvest yield impact; their effects are handled separately in `processTurn`).

---

## 2. PlotState (two new boolean fields)

**File**: `src/engine/types.ts`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `pestDamaged` | `boolean` | `false` | Plot was destroyed by Pest Infestation and awaits player acknowledgment. Blocks planting until cleared via `clearPestDamage()`. |
| `droughtPenalised` | `boolean` | `false` | Crop was planted during an active Flash Drought window. Growth time was doubled at planting. UI shows a drought icon for this plot's full growth period. |

**State invariants**:
- `pestDamaged: true` → `cropId === null` (crop was removed)
- `droughtPenalised: true` → `cropId !== null` (only set at planting; cleared when crop is harvested)
- `pestDamaged` and `exhaustedSinceDay !== null` cannot both be true on the same plot at the same time (pest destruction only targets occupied plots; exhausted plots have no crop)

**State transitions for `pestDamaged`**:
```
occupied → (pest roll fails) → pestDamaged=true, cropId=null
pestDamaged=true → (player clicks + confirms "Clear Plot") → pestDamaged=false
```

**State transitions for `droughtPenalised`**:
```
empty → (plantSeed, flashDroughtDaysRemaining > 0) → droughtPenalised=true, daysRemaining doubled
droughtPenalised=true → (harvest) → droughtPenalised=false, cropId=null
```

---

## 3. GameState (one new field)

**File**: `src/engine/types.ts`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `flashDroughtDaysRemaining` | `number` | `0` | Number of calendar days remaining in the active Flash Drought window. Decrements by 1 each turn (after day increment), **except** on the turn Flash Drought itself fires (`weatherId === 'flash_drought'`) — the decrement is skipped that day so both N+1 and N+2 planting days fall within the penalty window. Stacks: a second Flash Drought adds 2 to the current counter. |

**Invariant**: `flashDroughtDaysRemaining >= 0` always.

---

## 4. DailyLogEntry (two new fields)

**File**: `src/engine/types.ts`

| Field | Type | Description |
|-------|------|-------------|
| `pestDestroyedPlots` | `number[]` | Plot IDs destroyed by Pest Infestation this turn. Empty array (`[]`) on all non-pest turns. |
| `flashDroughtDaysAfter` | `number` | Value of `flashDroughtDaysRemaining` at the end of this turn's processing. `0` when no drought is active. |

---

## 5. PlantResult (extended error union)

**File**: `src/engine/types.ts`

```ts
// Before
export type PlantResult =
  | { ok: true; state: GameState }
  | { ok: false; error: 'no_seed' | 'plot_occupied' | 'plot_exhausted' | 'invalid_plot' };

// After
export type PlantResult =
  | { ok: true; state: GameState }
  | { ok: false; error: 'no_seed' | 'plot_occupied' | 'plot_exhausted' | 'plot_pest_damaged' | 'invalid_plot' };
```

**Guard order in `plantSeed`** (unchanged where existing; `plot_pest_damaged` inserted between `plot_exhausted` and `no_seed`):
1. `invalid_plot`
2. `plot_occupied`
3. `plot_exhausted`
4. `plot_pest_damaged` ← new
5. `no_seed`

---

## 6. ClearPestDamageResult (new result type)

**File**: `src/engine/types.ts`

```ts
export type ClearPestDamageResult =
  | { ok: true; state: GameState }
  | { ok: false; error: 'plot_not_pest_damaged' | 'invalid_plot' };
```

---

## 7. New/modified WEATHER_DEFINITIONS entries

**File**: `src/engine/constants.ts`

Three new entries added to `WEATHER_DEFINITIONS`:

| id | name | multiplier | description |
|----|------|------------|-------------|
| `blight` | `Blight` | `0.1` | A fungal blight devastates the harvest. |
| `pest_infestation` | `Pest Infestation` | `1.0` | Pests invade and destroy crops before they can be picked. |
| `flash_drought` | `Flash Drought` | `1.0` | A sudden drought will slow crop growth for the next 2 days. |

`WEATHER_IDS` array is **removed** (no longer used; selection is now probability-band based).

New constant:
```ts
export const WEATHER_PROBABILITY_BANDS: Array<{ threshold: number; id: WeatherId }> = [
  { threshold: 0.05, id: 'blight' },
  { threshold: 0.10, id: 'pest_infestation' },
  { threshold: 0.15, id: 'flash_drought' },
  { threshold: 0.32, id: 'drought' },
  { threshold: 0.49, id: 'overcast' },
  { threshold: 0.66, id: 'sunny' },
  { threshold: 0.83, id: 'warm_breeze' },
  { threshold: 1.00, id: 'perfect_sun' },
];
```

---

## 8. Schema version

**File**: `src/engine/constants.ts`

```ts
export const SCHEMA_VERSION = 3;  // was 2
```

Old saves at schema version 2 are discarded on load; a fresh game is started (existing migration behaviour).

---

## 9. Summary of initialGameState() changes

`initialGameState()` must initialise:
- Each `PlotState`: `pestDamaged: false`, `droughtPenalised: false`
- `GameState`: `flashDroughtDaysRemaining: 0`

Each `DailyLogEntry` built in `processTurn` must include:
- `pestDestroyedPlots: []` (or list of IDs on a pest turn)
- `flashDroughtDaysAfter: state.flashDroughtDaysRemaining` (post-decrement value)
