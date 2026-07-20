# Design: Onboarding Funnel Analytics (backlog A1)

**Date:** 2026-07-19
**Status:** Approved (design), ready for implementation planning
**Scope:** Onboarding step funnel, skip point, completion, tutorial replay, and empty-day
safeguard events on top of the 017 analytics layer, plus an MCP-provisioned
"Pixel Parsnips — Onboarding" dashboard
**Branch:** `020-onboarding-analytics`

## Problem & Goals

017 (backlog A0) shipped the shared analytics layer and the core gameplay funnel, but the
onboarding tutorial (014, "Your First Harvest") is still metrics-blind. The only signal today is
the coarse `play_started { onboarding_active }` flag. We cannot answer:

- **Where do new players drop off** inside the guided flow?
- **Which step do skippers bail from** — and how many come back via "Replay tutorial"?
- **How often do players hit the empty-Next-Day bankruptcy guard**, and what do they do there?

This design adds the granular funnel on top of A0's layer. It introduces **five new events**,
reuses A0's consent gate, globals, and no-key no-op unchanged, and provisions one new dashboard.

### Pre-design validation (2026-07-19)

- All 8 A0 events verified arriving in PostHog (EU project 216788), freshest same-day;
  `play_started.onboarding_active` carries both `true` and `false` values.
- The "Pixel Parsnips — Core" dashboard (id 798528) has all 7 tiles from spec 017 referencing
  valid events; the North Star cohort (174203) exists and recalculates. No broken tiles.
- Gap confirmed: zero onboarding-specific insights or dashboards exist.

### Non-Goals

- No changes to the onboarding flow itself (014 behavior is untouched; this is observation only).
- No new consent surface — A0's opt-out/DNT gate covers the new events.
- No `ANALYTICS_SCHEMA_VERSION` bump — new events enter `EVENT_VERSIONS` at version 1.
- No server-side collection; client-side only, same as A0.
- No A/B experiments on onboarding (a later feature can build on these events).

## Decisions (locked)

| Decision | Choice |
|---|---|
| Event design | **Single `onboarding_step_reached` event** with `step` property + companion events (approach 1); not per-step event names, not a render-diff extension |
| Emit seams | `useOnboarding` transition points (mirrors `saveOnboarding` calls); safeguard from `GameBoard` dialog callbacks; replay from `App`'s `onReplayTutorial` handler |
| Safeguard scope | **All players**, with `onboarding_active` property — not tutorial-only |
| Terminal step | `done` is **never** emitted as `step_reached`; the terminal outcome is exclusively `onboarding_completed` XOR `onboarding_skipped` |
| Safeguard timing | Emitted on dialog **resolution** (`advanced`/`cancelled`), not on display |
| Step names | The code's names are canonical (`buy-radishes`, not the backlog's `buy-radish`) |
| Dashboards | New dedicated **"Pixel Parsnips — Onboarding"** dashboard (6 tiles), provisioned via the connected PostHog MCP (like 017 Phase C); Core dashboard untouched |
| Delivery phasing | This session: spec + plan only. Implementation (code + dashboard) in a later session |

## Event Schema

Additions to `EventPropsMap` in `src/analytics/events.ts`; all enter `EVENT_VERSIONS` at 1.
`step_index` is the position in the `STEPS` array of `src/engine/onboarding.ts` (0 = `welcome` …
5 = `payoff`); it exists so PostHog insights can sort and range-filter steps without a lookup.

| Event | Properties | Fires when |
|---|---|---|
| `onboarding_step_reached` | `step: OnboardingStep`, `step_index: number` (0–5) | The player reaches a tutorial step: `welcome`, `open-shop`, `buy-radishes`, `plant`, `advance`, `payoff`. Once per step per tutorial pass, in order. |
| `onboarding_completed` | — | The payoff popup is dismissed (natural finish). |
| `onboarding_skipped` | `from_step: OnboardingStep`, `from_step_index: number` | The skip control is used; carries the step the player was on. |
| `onboarding_replay_requested` | — | The run-end "Replay tutorial" button is pressed. |
| `empty_day_safeguard` | `action: 'advanced' \| 'cancelled'`, `onboarding_active: boolean`, `day: number`, `coin_balance: number` | The `EmptyDayConfirm` dialog resolves — for **all** players. |

Funnel semantics:

- **`done` is never a `step_reached`.** Both completing and skipping drive the step machine to
  `done`, so emitting it would make the funnel's final step ambiguous. The funnel's last step is
  `onboarding_completed`; `onboarding_skipped` is the labeled exit.
- **One event per encounter for the safeguard.** Counting resolutions gives frequency (event
  count) and behavior (breakdown by `action`) in one event. `cancelled` means the guard worked —
  the player went back to plant; `advanced` means they pushed through an empty day.
- A replayed tutorial legitimately re-emits the whole funnel for the same person; PostHog funnels
  count unique persons per step, so replays do not inflate conversion.

## Emit Points

All step/skip/complete emissions live in `src/hooks/useOnboarding.ts`, at the exact seams that
already call `saveOnboarding` — tracking mirrors persistence. UI components stay analytics-free
except for the two event sources that only exist in the UI layer (safeguard dialog, replay
button).

| Emission | Seam |
|---|---|
| `step_reached('welcome', 0)` | One-time init when a fresh first run activates the tutorial (`active` becomes true with step `welcome`). Not on resume-after-refresh at a later step. |
| `step_reached('open-shop', 1)` | `onStart` (welcome dismissed via "Show me"). |
| `step_reached(step, i)` for auto steps | The `deriveStep` effect. When the cascade jumps several steps in one pass (on desktop the always-visible shop makes `open-shop` pass through instantly), **each intermediate step emits in order**, walking `STEPS` from the previous index + 1 to the new index — the funnel stays monotonic. |
| `onboarding_skipped` | `onSkip`, capturing the current step before `finish()`. |
| `onboarding_completed` | `onDismissPayoff`. |
| `onboarding_replay_requested` | `App.tsx`'s `onReplayTutorial` handler (alongside `requestOnboardingReplay()`). |
| `empty_day_safeguard` | `GameBoard.tsx`'s `EmptyDayConfirm` callbacks: `onAdvance` → `action: 'advanced'`, `onCancel` → `action: 'cancelled'`; `onboarding_active` from the onboarding hook, `day`/`coin_balance` from game state. |

Consent (opt-out + DNT), globals (anonymous player id, session id, app version, device type),
and the no-key no-op all come free from A0's `track()` — no new plumbing.

## PostHog Dashboard (provisioned via MCP, implementation session)

New dashboard **"Pixel Parsnips — Onboarding"** in project 216788, created after the events ship
and seed data exists (mirrors 017 Phase C: `insight-create` → `dashboard-create`, then validated
with `dashboard-insights-run`).

| # | Tile | Insight |
|---|---|---|
| 1 | **Onboarding funnel** | Funnel: `onboarding_step_reached` filtered `step=welcome` → `open-shop` → `buy-radishes` → `plant` → `advance` → `payoff` → `onboarding_completed`. Description carries the interpretation note: on desktop `open-shop` auto-passes (sidebar shop is always visible), so its conversion reads ~100% and the interesting drop-offs start at `buy-radishes`. |
| 2 | **Skip points** | Bar: `onboarding_skipped` broken down by `from_step`. |
| 3 | **Completion vs skip** | Weekly trend: `onboarding_completed` and `onboarding_skipped` as two series. |
| 4 | **Replay requests** | Trend: `onboarding_replay_requested`. |
| 5 | **Safeguard triggers — behavior** | Trend: `empty_day_safeguard` broken down by `action`. |
| 6 | **Safeguard triggers — context** | Trend: `empty_day_safeguard` broken down by `onboarding_active`, separating tutorial encounters from regular play. |

## Edge Cases

- **Pre-feature runs**: a run already past day 1 auto-marks onboarding complete
  (`markOnboardingComplete()` in the init path) — this emits **nothing**. The player never saw
  the tutorial, and that auto-complete is not a skip.
- **Skip at `welcome`** is valid: `from_step: 'welcome'` (player declined before starting).
- **Resume after refresh**: init restores the saved step without re-emitting — no transition
  happened; the earlier session already emitted the steps up to there under the same person.
- **localStorage disabled**: onboarding restarts every session, so `welcome` may re-emit per
  session. Accepted; person-unique funnel counting bounds the distortion.
- **React StrictMode double-invocation**: emissions are guarded with refs (same discipline as
  A0's once-per-run guards) so dev double-mounts don't double-fire.
- **Replay loop**: replay resets the record, the next fresh game re-runs the tutorial, and the
  funnel re-emits — intended, see funnel semantics.

## Testing

Unit tests in the existing A0 style (mock `track`, assert emissions):

- `useOnboarding` via `renderHook`: fresh-run welcome emission; `onStart`; auto-cascade emitting
  intermediates in order (desktop shop-visible case); skip from each gate type; completion;
  resume-after-refresh emitting nothing; StrictMode-safe single emission.
- `GameBoard` safeguard: dialog advance → `action: 'advanced'`; cancel → `action: 'cancelled'`;
  `onboarding_active` reflects tutorial state.
- `App`-level replay button → `onboarding_replay_requested`.
- Schema: new events present in `EVENT_VERSIONS` at 1.

Gate: `npm test && npm run lint`.

## Implementation Phasing (for plan.md)

- **Phase A — Schema**: extend `events.ts` (`EventPropsMap`, `EVENT_VERSIONS`).
- **Phase B — Emit seams**: `useOnboarding` step/skip/complete; `App` replay; `GameBoard`
  safeguard. Tests per seam.
- **Phase C — Dashboard**: provision "Pixel Parsnips — Onboarding" via the PostHog MCP after
  events are live; validate tiles render with seed data; update `backlog.md` (mark A1 done).
