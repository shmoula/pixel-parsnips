# Contract: localStorage Schema

**Feature**: 001-farming-tycoon-game
**Date**: 2026-03-16

## Storage Key

```
pixel-parsnips-state
```

## Stored Value Shape

```typescript
interface StoredData {
  schemaVersion: number;  // Must equal SCHEMA_VERSION constant (currently 1)
  state: GameState;       // Full game state as defined in data-model.md
}
```

## Serialisation

`JSON.stringify(storedData)` written as a single string value.
`JSON.parse(raw)` on read; parsed to `StoredData`.

## Loading Rules

| Condition | Behaviour |
|-----------|-----------|
| Key absent | Start fresh (`initialGameState()`) |
| JSON parse error | Start fresh; log warning to console |
| `schemaVersion !== SCHEMA_VERSION` | Start fresh; discard stale data |
| `schemaVersion === SCHEMA_VERSION` | Restore `state` from stored value |

## Write Triggers

State is written to localStorage after each of these events:
- `nextDay()` completes (including bankrupt transition)
- `plantSeed()` succeeds
- `buySeed()` succeeds
- `buyUpgrade()` succeeds
- `restart()` (key is cleared then fresh state written)

## Schema Migration Policy

When `SCHEMA_VERSION` is incremented in code:
- Old data is silently discarded and a new game starts
- A `console.info` message MUST be logged: `"[PixelParsnips] Save data schema
  upgraded from vX to vY — starting a new game."`
- No migration transforms are performed (game state is non-critical; a fresh
  start is acceptable)

## Estimated Size

| Field | Approximate size |
|-------|-----------------|
| 12 plots | ~600 B |
| Seed inventory | ~60 B |
| Last daily log | ~400 B |
| Scalars (day, balance, etc.) | ~100 B |
| **Total** | **< 2 KB** |

Well within the 5 MB localStorage quota. No size guards required.
