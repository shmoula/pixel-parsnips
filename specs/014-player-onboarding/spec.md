# 014 — Player Onboarding ("Your First Harvest")

**Status:** Design approved · 2026-06-26
**Backlog item:** UI.md #5 (Zero first-run onboarding) + #6/#8 first-session confusion · analytics deferred to backlog [A1](../../backlog.md)
**Refs:** `player-onboarding` skill — patterns: *Nintendo 1-1*, *30-Second Hook*, *Show Don't Tell*, *Progressive Disclosure*, *Safe Failure*, *Veteran Respect*; sharp edges: *tutorial-jail*, *information-overload*, *hard-fail-during-tutorial*, *no-skip-on-replay*, *skipping-breaks-game*
**Effort:** M

---

## Summary

New players open Pixel Parsnips to 130 coins, an empty 4-plot farm, and no instructions. The
intended first sequence — open Shop → buy seed → plant → Next Day → harvest — is communicated
nowhere, and clicking **Next Day** on an empty farm silently drains lease + tax toward bankruptcy
(UI.md #5/#63). This feature teaches the core loop by **doing it**, not by explaining it.

Two parts ship together:

1. **"Your First Harvest"** — a first-run guided overlay that spotlights the *real* UI and walks the
   player through one complete loop, ending on a guaranteed coin payoff. It teaches by play (Show,
   Don't Tell), one concept at a time, and is always skippable.
2. **Empty-day safeguard** — an always-on guard (independent of the tutorial) that warns before
   advancing a day with nothing planted and nothing growing, protecting players who skip and
   players who return later with an idle farm.

The tutorial is the actual core loop with a spotlight on top — there is no separate tutorial level
and no gating of gameplay (avoids *tutorial-jail*). The first resolved turn's weather is pinned to a
non-disaster outcome so the payoff always lands (*safe failure*).

---

## Goals

- Get a new player from cold start to their first harvested profit in **one turn (~30–45 s)**,
  having performed the loop themselves.
- Teach the **shop → plant → advance → harvest** loop and surface the **lease/tax** cost *after* the
  first win (so the lose-condition is felt in context, not front-loaded).
- Prevent the hidden empty-day bankruptcy trap for *all* players, tutorial or not.
- Respect veterans and replayers: skippable at every step, never repeats once completed (even across
  Restart), explicitly replayable from the run-end screen.
- Add no balance risk: the flow uses the real engine with a pinned-safe first turn; no economy
  numbers change.

## Non-goals

- No separate tutorial level, sandbox, or scripted fake farm — it drives the live game.
- No gating of gameplay on tutorial completion (*tutorial-jail*); the player may skip into free play
  at any instant.
- No multi-panel text explainer up front (*information-overload* / text-wall) — copy is per-beat,
  short, anchored to a real element.
- No teaching of obvious/secondary mechanics (fertilizer, exhaustion, upgrades, seasons depth,
  market events) — those are discovered through play or taught contextually later.
- No analytics wiring in this PR — emit points are structured in but unwired (see
  [Deferred: analytics](#deferred-analytics)).
- No new settings/menu surface (the Replay entry lives on an existing screen).

---

## The guided flow — "Your First Harvest"

A soft-focus spotlight overlay rendered above the live game. **Each step completes on the player's
real action**, not a "Next" button. Nothing is hard-disabled (soft focus / free clicks): the
spotlight draws the eye, but the player may poke anywhere and the step still completes when its
**goal** is met. Copy uses a playful pixel-farmer voice, kept short and scannable.

| Step | Spotlight anchor | Copy (playful) | Completes when |
|------|------------------|----------------|----------------|
| `welcome` | Centered card + primary CTA | "Grow crops. Sell 'em. Don't go broke. Let's fill your farm with radishes!" | CTA tapped |
| `open-shop` | Shop button (HUD) | "Pop open the shop." | Shop panel is open |
| `buy-radishes` | Radish seed card (other cards dimmed) | "Radishes sprout overnight — grab one per plot." | Inventory holds **≥ 1 radish per empty plot** (4 at start) |
| `plant` | Pulsing empty plots | "Fill every plot — more crops, more coins." | **All available plots are planted** |
| `advance` | Next Day button (HUD) | "Sleep on it — advance a day." | A turn is processed |
| `payoff` | Coin balance **and** the season-target HUD chip | "Sold for +{harvestIncome} coins! 🎉 That's the loop. Now hit your season target." | Player dismisses |
| `done` | — | (none) | Marks tutorial complete |

### Design decisions baked in

- **Buy in the shop (not pre-gifted).** The shop is the engine of the whole game and has the weakest
  discoverability (UI.md #7); teaching it on turn 1 is the highest-value beat.
- **Fill the plots — one radish is a deliberate loss (see [Economics](#economics-why-fill-the-plots)).**
  The `buy-radishes` step requires enough radishes to fill every empty plot, and `plant` requires
  all plots planted. A single radish nets *negative* on day 1 (lease + tax exceed one harvest), which
  would make the "+coins! 🎉" payoff a lie. Filling all 4 starting plots produces a clearly positive
  day. Planting 4 also gives the player **four reps of the plant action** — reinforcement, not just a
  one-shot demo (avoids *no-reinforcement-after-teaching*).
- **Require radish specifically** on `buy-radishes`. Other seed cards are visually dimmed and do not
  advance the step. Radish's 1-day growth guarantees the harvest lands on the very next turn. (If the
  player also plants a non-radish from pre-existing inventory on replay, the `plant` step still
  completes once all plots are filled; only the *buy* step is radish-gated.)
- **Soft focus / free clicks.** No element is disabled. The step machine checks *goal state*, not a
  prescribed path, so off-script exploration never softlocks the flow (*single-path* avoidance).
- **Minimal welcome.** Only the immediate goal is framed; seasons, reputation, market events,
  exhaustion are discovered through play, not front-loaded.
- **Handoff to the win condition.** The `payoff` beat spotlights the existing season **Survival
  Target** HUD chip, connecting the just-learned loop to the actual goal and giving an immediate
  next objective.

### Economics — why fill the plots

Season 1 fixed daily costs are **lease 15** (`economy.ts` Spring Thaw `leasePerDay`) **+ tax 6% of
post-lease balance** (`gameEngine.ts` step 7) ≈ **8** at starting wealth → a ~**23-coin daily nut**.
Radish is `baseSeedCost 5` / `baseYield 12`. Worked turns from a 130-coin start (incl. the +5
first-harvest streak bonus, applied before the bankruptcy check):

| Radishes planted | Buy | Harvest (+streak) | Lease | Tax | End balance | Net day |
|---|---|---|---|---|---|---|
| **1** | −5 | +12 (+5) | −15 | −7 | **120** | **−10** ❌ |
| **4 (fill plots)** | −20 | +48 (+5) | −15 | −8 | **140** | **+10** ✅ |

One radish is a guaranteed *loss*; filling all four plots is a clear *profit* with a satisfying
**+48 harvest** hero number. This is why the flow guides planting one radish **per plot**, not one
total. The `payoff` beat surfaces the **harvest income** (gross sale, always positive and sizable),
not the slimmer net balance delta — the lease/tax bite is what the season-target handoff and the
empty-day safeguard teach next.

> If crop or economy numbers are ever retuned (they are sim-gated — see backlog), re-check that
> "fill the starting plots with radishes" still nets positive on the pinned-weather first turn.

### Turn-1 safe weather (no engine change)

When the player advances during the `advance` step, the React layer passes a **non-disaster
`weatherRoll`** into the existing `processTurn(state, weatherRoll?, …)` override parameter
(`gameEngine.ts:276`). Concretely the hook's advance action accepts an optional forced weather and
the onboarding controller supplies a benign outcome (e.g. `'sunny'`) for that one turn only. No
change to weather bands, economy, or `processTurn` internals — this reuses the same override path
tests already use. Every subsequent turn is fully random.

> Rationale: a ~15% chance of Blight/Pest/Drought on the tutorial turn would turn the "+coins! 🎉"
> beat into a loss, directly undercutting *safe failure*. Pinning only the first onboarding turn
> removes that without touching difficulty.

---

## The empty-day safeguard (always-on)

Independent of the tutorial flag — protects skippers and returning idle players.

**Condition (`canAdvanceProductively`):** a pure selector over `GameState` →
`false` when **no seed is in inventory** AND **no plot is currently growing a crop**
(i.e. advancing produces no harvest, only costs).

**Behavior when `canAdvanceProductively === false`:**

1. The **Next Day** button label changes to **"Plant seeds first →"** (still enabled — see below).
2. On click, a **one-time soft confirm** appears: *"Nothing's planted — advance anyway?"* with
   **Advance** / **Cancel**.
3. **Advance** processes the turn as normal; **Cancel** dismisses.

The confirm is a *soft* gate, not a hard block: advancing an empty day is a legitimate move (e.g.
letting an exhausted plot recover over time). This preserves agency while removing the silent-drain
surprise. The safeguard never shows a game-over and never blocks — it informs.

> Interaction with the tutorial: during the guided flow the player reaches `advance` already holding
> a planted radish, so the safeguard does not fire mid-tutorial. The two systems are orthogonal.

---

## Persistence & lifecycle

### Where completion is stored — **NOT in `GameState`**

`GameState` resets on Restart / new game. Storing `tutorialComplete` there would replay the tutorial
every new run — the *no-skip-on-replay* anti-pattern. Instead, completion lives in a **separate
persistent localStorage key**, mirroring the established `records.ts` pattern
(`pixel-parsnips-records`, own `schemaVersion`, defensive parse, untouched by Restart).

New module **`src/engine/onboarding.ts`** (pure load/save like `records.ts`), key
**`pixel-parsnips-onboarding`**:

```ts
interface OnboardingRecord {
  schemaVersion: number;   // own version, independent of GameState's SCHEMA_VERSION
  completed: boolean;      // set true on `done`; survives Restart
  step: OnboardingStep;    // last reached step, for resume-on-refresh
}
// default when absent/malformed: { schemaVersion: 1, completed: false, step: 'welcome' }
```

- **`completed`** gates whether the tutorial ever auto-starts. Once `true`, it never auto-fires
  again — including on Restart and new games.
- **`step`** lets a mid-tutorial page refresh resume where the player left off rather than
  restarting the flow. (Goal checks reconcile it with live game state — e.g. if a radish is already
  planted, resume at `advance`.)
- Defensive parse: malformed/absent record → treated as a fresh, not-completed onboarding,
  consistent with `records.ts` load hardening. Never throws on load.

**`GameState.schemaVersion` is NOT bumped** (stays 8). This feature adds no fields to the economy
state and needs no save migration. The empty-day safeguard reads existing `GameState` fields only.

### Auto-start condition

On app mount: auto-start the guided flow when `OnboardingRecord.completed === false` **and** the
game is at a fresh/early state (Day 1, untouched). A returning player mid-run (record absent because
they predate this feature, but already deep in a run) should **not** be yanked into a tutorial —
treat an in-progress run with `completed === false` and `currentDay > 1` as completed (set
`completed = true` silently). This protects existing players, analogous to the migration philosophy
in 010/012 ("never punish existing runs").

### Skip

- A **Skip** affordance is visible at **every step**, top-right, **no confirmation** (*veteran
  respect*).
- Skipping sets `completed = true` and dismisses the overlay. Because the flow is *real play*, there
  is **no state to repair on skip** (*skipping-breaks-game* is structurally impossible — the player
  simply keeps whatever coins/plots/inventory they currently have). No grants needed.

### Replay

- A **"Replay tutorial"** button is added to the run-end screen (`BankruptcyScreen.tsx`), beside
  Restart — a natural re-engagement moment with no new UI surface.
- Replay re-triggers the guided flow on the next fresh game (resets the in-memory step to `welcome`;
  `completed` is re-set to `true` when that replay finishes). Replay drives whatever the live game
  state is; the radish-gated `buy-radishes` step still teaches the shop cleanly.

---

## Implementation surface

| Area | File | Change |
|------|------|--------|
| Persistence | `src/engine/onboarding.ts` *(new)* | `OnboardingRecord` load/save, own key + version, defensive parse — mirrors `records.ts`. |
| Step type | `src/engine/types.ts` | `export type OnboardingStep = 'welcome' \| 'open-shop' \| 'buy-radishes' \| 'plant' \| 'advance' \| 'payoff' \| 'done';` (no `GameState` change). |
| Controller | `src/engine/useGameEngine.ts` | Hold current `onboardingStep`; observe `buySeed`/`plantSeed`/turn-processed to advance by goal; expose `canAdvanceProductively`; on the onboarding advance, pass a non-disaster `weatherRoll` into `processTurn`. |
| Overlay UI | `src/components/OnboardingOverlay.tsx` *(new)* | Spotlight/coach-mark layer: reads current step + target anchor, renders short copy + Skip. Soft focus (highlight, no blocking). Respects reduced motion. |
| Mount + anchors | `src/components/GameBoard.tsx` | Render `OnboardingOverlay`; provide anchors/refs for Shop button, an empty plot, Next Day button, coin balance, season-target chip. |
| Safeguard | `src/components/HUD.tsx` | Next Day label flips to "Plant seeds first →" when `!canAdvanceProductively`; one-time soft-confirm on click. |
| Dimming | `src/components/Shop.tsx` / seed card | During `buy-radishes`, non-radish cards rendered dimmed (presentational only; not disabled). |
| Replay entry | `src/components/BankruptcyScreen.tsx` | "Replay tutorial" button beside Restart. |

The engine (`gameEngine.ts`) changes are limited to (optionally) threading a forced `weatherRoll`
from the hook on the onboarding turn — and that parameter already exists. No new economy logic.

---

## UI & copy rules

- **Per-beat copy ≤ ~12 words**, one idea per beat (the playful voice is allowed to be slightly
  longer than the 8-word ideal, but stays scannable).
- Spotlight = a highlight/glow on the anchor + a small copy bubble; the rest of the screen is gently
  dimmed but fully interactive (soft focus).
- **Mobile:** the shop is a bottom sheet — the `open-shop` beat anchors to the mobile Shop button and
  the `buy-radishes` beat anchors inside the opened sheet. The flow must work in the 4-column mobile
  grid and the desktop 6-column grid.
- **Skip** chip: persistent, top-right, high-contrast, no confirm dialog.
- The `payoff` beat reads the real harvested amount (`+{N} coins`) from the resolved turn, not a
  hard-coded number.

---

## Accessibility

- The overlay respects **`prefers-reduced-motion`**: pulse/spotlight animations are replaced by a
  static highlight (UI.md #4 wants this project-wide; this feature must not regress it).
- Copy bubbles use `role="dialog"`/`aria-live` appropriately so step text is announced; the Skip
  control is keyboard-focusable and reachable at every step.
- The soft-confirm in the safeguard is keyboard-operable with a clear default focus on **Cancel**.

---

## Testing

**Persistence (`onboarding.ts`)**
- Absent record → defaults to `{ completed: false, step: 'welcome' }`.
- Malformed JSON / wrong shape → defaults without throwing (load hardening).
- `completed` round-trips and survives a simulated Restart (separate key untouched by game reset).

**Auto-start / existing-player protection**
- Fresh state + `completed: false` → flow auto-starts at `welcome`.
- `completed: true` → flow does not auto-start.
- `completed: false` but `currentDay > 1` (pre-feature run in progress) → silently marked complete,
  no tutorial.

**Step machine (goal-based advancement)**
- `welcome` → CTA advances to `open-shop`.
- `open-shop` completes only when the shop opens.
- `buy-radishes` completes only when inventory holds **≥ 1 radish per empty plot** (4 at start);
  buying fewer, or buying parsnip/pumpkin, does **not** advance it.
- `plant` completes only when **all available plots are planted**; planting a single plot does not
  advance it.
- `advance` completes when a turn is processed.
- Off-script clicks during a step never softlock; the step completes when its goal state is reached.
- Resume: refresh mid-flow restores `step`, reconciled with live state (all plots already planted →
  resume at `advance`).

**Turn-1 safe weather & positive payoff**
- The onboarding advance passes a non-disaster `weatherRoll`; the resolved turn is never a disaster.
- With all 4 starting plots planted in radishes, the pinned first turn ends **net positive**
  (end balance > starting 130) and reports a positive harvest income for the `payoff` number.
- The *next* turn after onboarding is fully random (no lingering pin).

**Safeguard (`canAdvanceProductively`)**
- Empty inventory + no growing crops → selector `false`; Next Day shows "Plant seeds first →".
- Seed in inventory OR a crop growing → selector `true`; normal label, no confirm.
- Soft-confirm: **Advance** processes the turn; **Cancel** does nothing; neither shows a game-over.
- Advancing an empty day intentionally (via confirm) still works (legitimate recovery move).

**Skip / replay**
- Skip at any step sets `completed: true`, dismisses overlay, leaves game state untouched (no
  grants, no repair needed).
- "Replay tutorial" on the run-end screen re-runs the flow on the next fresh game and re-completes.

**Accessibility**
- With `prefers-reduced-motion`, no spotlight animation runs (static highlight only).
- Skip control is keyboard-reachable at every step.

---

## Deferred: analytics

Per the onboarding-brainstorm decision (2026-06-26), **no analytics are wired in this PR.** The step
machine is structured so each transition (`welcome`→…→`done`), the skip point, completion, replay,
and the safeguard trigger have obvious single emit points — but instrumentation waits for the shared
telemetry layer tracked as backlog **[A1](../../backlog.md)** ("instrument all events together").
This accepts the references' *metrics-blind-onboarding* risk in the short term in exchange for one
clean analytics integration later rather than scattered call sites now.

---

## Out of scope

- Analytics/telemetry (backlog A1).
- A settings/menu surface (Replay lives on the run-end screen only).
- Contextual just-in-time hints for later mechanics (low-balance warning, fertilize-exhausted-plot,
  market-event tips) — a possible follow-up, not this feature.
- Teaching seasons/reputation/market-events/exhaustion explicitly.
- Any economy/balance number change (this feature is sim-neutral; no `npm run sim` gate required).
- Difficulty-select ("I'm new / I know this") — single-track flow with Skip is sufficient for a
  game this light.
</content>
</invoke>
