# Contract: localStorage Schema (v2 — Plot Exhaustion Delta)

**Feature**: 002-plot-exhaustion-maintenance
**Date**: 2026-03-17
**Base**: Extends `specs/001-farming-tycoon-game/contracts/localstorage-schema.md`

This document records only the **changes** to the 001 localStorage schema.
All unchanged rules (storage key, serialisation, write triggers, size) remain as in 001.

---

## Changed: Schema Version

```typescript
const SCHEMA_VERSION = 2;   // was 1
```

---

## Changed: Stored Value Shape

```typescript
interface StoredData {
  schemaVersion: 2;    // [CHANGED] Must equal 2
  state: GameState;    // [UNCHANGED name — GameState itself extended, see data-model.md]
}
```

---

## Changed: Loading Rules

| Condition | Behaviour |
|-----------|-----------|
| Key absent | Start fresh (`initialGameState()`) — unchanged |
| JSON parse error | Start fresh; log warning — unchanged |
| `schemaVersion !== 2` | Start fresh; log migration message — **version number updated** |
| `schemaVersion === 2` | Restore `state` — unchanged logic |

**Migration log message** (when discarding a v1 save):
```
[PixelParsnips] Save data schema upgraded from v1 to v2 — starting a new game.
```

---

## Changed: Estimated Size

New fields add ~50 B per plot (two integers) × 12 plots = ~600 B, plus `fertilizerInventory` (~10 B).

| Field | Approximate size |
|-------|-----------------|
| 12 plots (v2) | ~1 200 B |
| Seed inventory | ~60 B |
| Fertilizer inventory | ~30 B |
| Last daily log | ~450 B |
| Scalars (day, balance, etc.) | ~100 B |
| **Total** | **< 2 KB** |

Well within the 5 MB localStorage quota. No size guards required.

---

## New Write Triggers (additions)

- `buyFertilizer()` succeeds
- `applyFertilizer()` succeeds
