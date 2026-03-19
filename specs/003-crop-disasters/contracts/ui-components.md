# Contract: UI Components — 003-crop-disasters

**Date**: 2026-03-19

Documents prop changes to existing components and the new sub-component introduced by this feature.

---

## PlotCard (modified)

**File**: `src/components/PlotCard.tsx`

### New props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `onClearPestDamage` | `(plotId: number) => void` | optional | Called when player confirms "Clear Plot" on a pest-damaged plot. |

> **Note**: No `flashDroughtDaysRemaining` prop is added. PlotCard derives the drought indicator directly from `plot.droughtPenalised` (a persisted field on `PlotState`), so no additional prop threading is required.

### New render branch: PestDamagedPlot

Fires when `plot.pestDamaged === true`. Renders before the `exhaustedSinceDay` check.

```
Priority order:
1. pestDamaged === true       → <PestDamagedPlot>
2. exhaustedSinceDay !== null → <ExhaustedPlot>   (unchanged)
3. cropId === null            → empty plot button  (unchanged)
4. cropId !== null            → growing/ready crop (modified: drought icon)
```

**PestDamagedPlot visual spec**:
- Emoji: 🐛
- Label: "Pest Damage"
- Sub-label: "Click to clear"
- Button: "Clear Plot" (appears on click, same pattern as "Use Fertilizer" on ExhaustedPlot)
- `aria-label`: `Plot N: Pest Damage — click to clear`

### Modified render: growing crop

When `plot.droughtPenalised === true`, render a drought icon (☀️🔥 or similar) alongside the existing crop emoji. The countdown display (`Nd left`) remains unchanged.

---

## FarmGrid (modified)

**File**: `src/components/FarmGrid.tsx`

### New props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `onClearPestDamage` | `(plotId: number) => void` | optional | Threaded through to each `PlotCard`. |

> **Note**: No `flashDroughtDaysRemaining` prop is added. The drought indicator on each plot is driven by `plot.droughtPenalised` (already present on each `PlotState` passed to `PlotCard`), so no extra threading is required.

---

## GameBoard (modified)

**File**: `src/components/GameBoard.tsx`

### New props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `onClearPestDamage` | `(plotId: number) => void` | ✅ | Wired from `useGameEngine.clearPestDamage`. |

### Flash Drought banner

When `state.flashDroughtDaysRemaining > 0`, render a persistent banner above the `FarmGrid`:

```
☀️🔥 Flash Drought — crops planted today grow at half speed. N day(s) remaining.
```

The banner disappears when the counter reaches 0.

---

## DailyLog (modified)

**File**: `src/components/DailyLog.tsx`

### Weather badge — disaster styling

When `log.weatherId` is `'blight'`, `'pest_infestation'`, or `'flash_drought'`, the weather badge renders in a distinct disaster style (e.g., red background / amber border instead of the current parchment/20 background).

Suggested classes: `bg-farm-red/20 border border-farm-red/40` for the badge container.

### New log sections

**Pest Infestation section** (rendered when `log.pestDestroyedPlots.length > 0`):

```jsx
{log.pestDestroyedPlots.map(plotId => (
  <div key={plotId} className="flex items-center gap-1 text-farm-red">
    <span aria-hidden="true">🐛</span>
    <span>Plot #{plotId + 1} destroyed by pests.</span>
  </div>
))}
```

**Flash Drought announcement** (rendered when `log.weatherId === 'flash_drought'`):

```jsx
<div className="flex items-center gap-1 text-amber-600">
  <span aria-hidden="true">☀️🔥</span>
  <span>Flash Drought! Crops planted in the next 2 days grow at half speed.</span>
</div>
```

**Blight annotation** (rendered when `log.weatherId === 'blight'`):

The existing weather multiplier display (`×0.1`) is sufficient; no additional section is needed. The disaster badge styling (above) provides the visual distinction.

---

## HUD (no changes)

Flash drought status is communicated via the GameBoard banner (above the FarmGrid), not the HUD. The HUD remains unchanged.
