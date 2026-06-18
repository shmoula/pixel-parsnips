# 013 — Disaster Reveal Juice (F2)

> Backlog item **F2** (Game Feel & Polish): "Juice pass — disaster reveal — reveal
> disasters last in Day Summary; pest 'scurrying' animation; Blight uses heavier
> visual weight." Source: p2·E. Priority Medium, Effort S–M.

Status: **Spec** — 2026-06-18.

## 1. Goal

Make the Day Summary modal deliver a "dread-then-hit" moment on disaster days: the
player reads the day's good news first, then the disaster lands last, with a single
unified high-weight banner. This is a pure **game-feel / presentation** change.

### Non-goals

- No engine, balance, or difficulty change. `npm run sim` is not involved.
- No `DailyLogEntry` type change and **no localStorage schema bump** — all data needed
  is already on the log.
- No change to plot exhaustion presentation — exhaustion is a soil mechanic, not a
  weather disaster, and stays a plain inline line.

## 2. Scope

**Disaster days** are defined by the existing set
`DISASTER_WEATHER_IDS = { blight, pest_infestation, flash_drought }`
(declared in `src/components/DailyLog.tsx`).

The three disasters share **one unified "heavy" banner treatment** (the design
direction chosen during brainstorming: the blight "heavy weight" style becomes the
base for all three). They differ only by icon and text:

| Weather | Icon | Banner text |
|---|---|---|
| `blight` | 🍄 | **BLIGHT** — a fungal blight devastated the harvest. (×0.2 yield) |
| `pest_infestation` | 🐛 | **PEST INFESTATION** — one line per destroyed plot: "Plot #N destroyed by pests." |
| `flash_drought` | ☀️🔥 | **FLASH DROUGHT** — next 2 days' crops grow at half speed. |

Note: the unified treatment intentionally supersedes the backlog's per-type
"pest scurrying" vs "blight heavier" split. All disasters get the same heavy weight.

## 3. Behavior — staged "dread-then-hit"

### Fresh open (auto-open after advancing the day), disaster weather

1. Modal opens **neutral**: normal `bg-farm-soil` background, no top "⚠️ Disaster!"
   badge, and the weather badge rendered **without** its red/alarm styling.
2. Good news (weather, market lines, harvests, streak) and the accounting rows render
   immediately.
3. After a short beat (~700ms) the reveal fires: the modal background tints to the
   disaster red (`bg-[#2A0A0A]`), the top "⚠️ Disaster!" badge appears, and the
   `DisasterBanner` drops in at the **bottom** (after accounting) with its animation.

### Reopen via "Last Turn"

No staging. Render the fully resolved disaster state immediately (red background, top
badge, and banner all present, no drop-in animation). Replaying the dread on a manual
reopen would be annoying.

### Non-disaster day

Unchanged from today — no neutral-then-red transition, no banner.

### `prefers-reduced-motion`

Honored. When the user prefers reduced motion, skip the stagger and all keyframe
animation entirely and render the resolved state immediately (equivalent to the
"Last Turn" reopen path).

## 4. Components

### New — `src/components/DisasterBanner.tsx`

- Renders the single unified heavy banner: dark-red fill, 2px border, slow pulse +
  glow, a gently animating icon, drop-in on mount.
- Receives the `DailyLogEntry` (or the specific fields it needs) and derives the
  icon + text per the table in §2.
- For `pest_infestation`, renders one line per id in `pestDestroyedPlots`.
- Animations apply only under `prefers-reduced-motion: no-preference`.

### Changed — `src/components/DailyLog.tsx`

- Remove the inline disaster elements that currently render mid-log:
  - the flash-drought announcement block (current lines ~125–130),
  - the pest-destroyed block (current lines ~132–142).
- The disaster weather badge (current lines ~98–108) suppresses its red/alarm styling
  while the reveal is pending (shown neutral); it regains alarm styling once revealed.
- The **exhaustion block stays** exactly as-is.
- The consolidated disasters now render via `DisasterBanner`, placed by the modal
  after the accounting rows.

Because `DailyLog` does not own the staging state, the modal controls whether the
banner/red styling is shown. Cleanest split: `DailyLog` keeps rendering the
non-disaster body and exhaustion; the `DisasterBanner` + the "Disaster!" badge +
red background are owned/gated by `DaySummaryModal`. `DailyLog` accepts a
`revealed`/`suppressDisasterStyling` signal so the weather badge can render neutral
during the pending beat.

### Changed — `src/components/DaySummaryModal.tsx`

- New prop `animateReveal?: boolean` (default `true`).
- Internal `revealed` state starts `false` only when `animateReveal && isDisaster &&
  motion allowed`; otherwise starts `true`.
- A `setTimeout` (~700ms) flips `revealed` to `true`; cleared on unmount.
- The disaster red background, the top "⚠️ Disaster!" badge, and the `DisasterBanner`
  are gated on `revealed`.
- Uses a small `useReducedMotion` hook (`window.matchMedia('(prefers-reduced-motion: reduce)')`).

### Changed — `src/components/GameBoard.tsx`

- Pass `animateReveal={true}` from the auto-open path (the effect at ~line 60–67 that
  fires after `onNextDay`).
- Pass `animateReveal={false}` from the "Last Turn" reopen path (the `onLastTurn`
  handler at ~line 110).

## 5. Animation infrastructure

Add the disaster keyframes to `src/App.css` alongside the existing keyframe, wrapped in
the existing `@media (prefers-reduced-motion: no-preference)` block so motion only plays
when allowed:

- `disaster-dropin` — translateY + fade-in on the banner.
- `disaster-pulse` — slow box-shadow glow pulse on the banner.
- `disaster-icon-creep` — gentle rotation wobble on the icon.

Rationale: this matches the existing `App.css` pattern (one keyframe + a
reduced-motion media block) rather than introducing a Tailwind config change for a
handful of one-off keyframes.

## 6. Testing

Vitest + Testing Library, following `tests/components/DailyLog.test.tsx`.

- **`DisasterBanner`**: renders the correct icon + text for each of the three disaster
  types; the pest banner renders one line per id in `pestDestroyedPlots`.
- **`DailyLog`**: no longer renders the old inline flash-drought / pest-destroyed
  lines; the exhaustion line still renders.
- **`DaySummaryModal`**:
  - `animateReveal=true` + disaster → banner and "Disaster!" badge absent initially,
    present after the timer fires (Vitest fake timers).
  - `animateReveal=false` (reopen) → banner and badge present immediately, no stagger.
  - Non-disaster day → no neutral-then-red transition; behaves as today.
  - Reduced-motion → resolved state rendered immediately, no stagger.
- Update existing `DailyLog` / `GameBoard` tests that assert the old inline disaster
  lines.

## 7. Acceptance criteria

- On a fresh disaster-day summary, the modal opens neutral, then after a beat tints red
  and drops in a single unified disaster banner at the bottom.
- All three disaster types use the same heavy banner styling, differing only by icon
  and text.
- Reopening a disaster summary via "Last Turn" shows the resolved state with no
  animation.
- Users with `prefers-reduced-motion` never see the stagger or keyframe motion.
- Plot exhaustion presentation is unchanged.
- `npm test && npm run lint` pass. No schema or engine changes.
