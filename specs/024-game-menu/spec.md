# 024 — Game Menu: consolidated chrome, asset attribution, mid-run restart

Status: **draft** (2026-08-21). Implements fix #5 of
[`70-DEEPDIVE.md` §3](../../../../game-ideas/70-DEEPDIVE.md) ("Move `Analytics: on` into a menu — it's
the only thing on screen that says *unfinished*"), plus three items raised in the 2026-08-21
brainstorm that share the same surface.

## Summary

Three loose controls currently float in the game's corners — an `Analytics: on` chip pinned
bottom-left, a mute button and a Last Turn button top-right. Two of them are settings, not
gameplay, and the analytics chip in particular reads as debug residue to a first-time visitor.

This spec introduces a single gear menu in the HUD's right cluster that owns every non-gameplay
control, adds the two things that had nowhere to live (an **asset attribution** screen, required by
the crop art's CC-BY-SA licence, and a **mid-run restart**), and fixes a HUD cursor bug found in the
same pass.

Purely presentational and organisational: **no engine changes, no `GameState` fields, no
localStorage schema bump.** Mute and analytics consent already persist under their own keys.

## Problem

| # | Finding | Evidence |
|---|---|---|
| 1 | `Analytics: on` is pinned in the viewport corner on every screen, including bankruptcy | [`AnalyticsOptOutToggle.tsx:34`](../../src/components/AnalyticsOptOutToggle.tsx) — `fixed bottom-20 left-2`; rendered twice from [`App.tsx`](../../src/App.tsx) |
| 2 | Mute sits in the HUD's action cluster beside gameplay buttons | [`MuteToggle.tsx`](../../src/components/MuteToggle.tsx), rendered at [`HUD.tsx:228`](../../src/components/HUD.tsx) |
| 3 | **No mid-run restart.** Restart exists only on terminal screens and the unwinnable banner | [`BankruptcyScreen.tsx:172`](../../src/components/BankruptcyScreen.tsx), `SeasonTransitionModal`, [`GameBoard.tsx:222`](../../src/components/GameBoard.tsx) |
| 4 | **Crop sprites are LPC-derived and uncredited in-product.** CC-BY-SA 3.0+ requires crediting the original authors and linking back | [`src/assets/crops/CREDITS-crops.txt`](../../src/assets/crops/CREDITS-crops.txt) — present in the repo, never shown to a player |
| 5 | `LICENSE` is plain MIT with no asset carve-out, which is inaccurate given #4 | [`LICENSE`](../../LICENSE) |
| 6 | **Cursor bug:** the Day and Reputation chips are `<button>`s whose only effect is toggling a `sm:hidden` label — at ≥640px they are no-ops that still show `cursor: pointer` | [`HUD.tsx:161`](../../src/components/HUD.tsx) (`seasonExpanded`), [`HUD.tsx:213`](../../src/components/HUD.tsx) (`repExpanded`) |

Finding 6 is worth stating precisely, because the naive fix is wrong: the toggles are **load-bearing
on mobile** — they are how `D1/20` expands into `Season 1 · Spring`. They are dead only at `sm` and
above, where the full labels always render.

## Goals

- One discoverable home for every non-gameplay control, so nothing on the play surface reads as
  unfinished.
- Satisfy the crop art's attribution obligation inside the product, not just in the repo.
- Give a player a way to abandon a live run without waiting to die.
- Remove the pointer cursor from elements that do nothing.

## Non-goals

- Any change to what analytics collects, to DNT handling, or to opt-out semantics. The control
  moves; its behaviour does not.
- Any change to the audio system. `MuteToggle`'s logic is reused as-is.
- Wiping personal records. Records live in a separate key, survive restart, and stay that way —
  accumulating failed runs is the point of the game.
- A settings *screen*. This is a menu of five rows, not a preferences system.

## Decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Menu contents | Restart run · Replay tutorial · Sound · Anonymous analytics · Credits | Settings and meta-actions only |
| **Last Turn stays in the HUD** | Not moved into the menu | It is a per-turn *read* action, not config. Burying "what did I just lose?" behind two taps works against the economy legibility the strategy doc names as a genuine strength |
| Trigger | **Gear icon**, HUD right cluster, replacing the mute button's slot | |
| Form factor | **Popover** anchored to the gear; **Credits opens a separate centered modal** on top | A full-screen sheet for five rows is heavy on desktop; credits text is too long for a popover |
| Scope | **HUD-only** — no gear on the bankruptcy or season-transition screens | Bankruptcy is the highest-intent moment in the game; adding chrome there dilutes restart + share |
| Restart confirmation | **Two-step arm**, reusing the existing `UnwinnableBanner` pattern | Consistent with code already in the repo; no new dialog primitive |
| Replay tutorial | **Also two-step**, labelled *"Replay tutorial (restarts run)"* | It calls `restart()`. In-place replay is a trap: the tutorial's anchors assume day 1 with four empty plots |
| Credits surface | **Self-contained in-game modal** | CC-BY-SA's link-back is satisfied by a visible in-product credit; a GitHub redirect is one players will not follow |
| Cursor fix | Chips render `<button>` below `sm`, `<div>` at `sm` and up | Preserves the mobile expand behaviour, kills the desktop no-op |
| Analytics events | Add **`credits_viewed`** only | `run_abandoned` already exists and already fires on restart ([`useAnalyticsEvents.ts:131`](../../src/analytics/useAnalyticsEvents.ts)). `menu_opened` is a vanity metric with no question behind it |
| Persistence | **None.** No `SCHEMA_VERSION` bump | Mute persists via `sfx.ts`, consent via `analytics/consent.ts` |

## Phase A — the menu

### Trigger

A gear button in the HUD's right cluster, occupying the slot `MuteToggle` vacates. Same chip
styling as its neighbours (`#261808` body, `#5C3D1E/50` border, 44px touch target below `md`).

```
desktop  … [↩ Last Turn] [⚙] [NEXT DAY →]
mobile   … [↩] [⚙]                            (Next Day lives in the bottom action bar)
```

### Popover

Anchored below-right of the gear, `z-50`, closes on outside click, on `Escape`, and on activating
any row that navigates away. Focus moves to the first row on open and returns to the gear on close.
`role="menu"`, rows are `role="menuitem"`. Not rendered at all while a run-ending screen is up
(see Scope).

| Row | Type | Behaviour |
|---|---|---|
| **Restart run** | Two-step | First activation arms: label becomes *"Tap again to restart"*. Disarms on popover close or after 5s. Second activation calls `restart()` and closes |
| **Replay tutorial** | Two-step | Label *"Replay tutorial (restarts run)"*. Second activation calls `requestOnboardingReplay()` then `restart()` |
| **Sound** | Toggle | Wraps existing `isMuted`/`setMuted`. Reads `Sound — on` / `Sound — off` |
| **Anonymous analytics** | Toggle | Wraps existing consent helpers. Reads `Anonymous analytics — on` / `— off` |
| **Credits** | Opens modal | Fires `credits_viewed`, opens the attribution modal |

### The DNT case

`isDoNotTrack()` hard-disables tracking regardless of the local flag. Today that is conveyed by a
`disabled` attribute plus a `title` tooltip — **unreachable on touch**. In the menu it becomes
visible sub-text under the row:

> Anonymous analytics — off
> *Your browser's Do Not Track setting is on.*

Row stays non-interactive in that state, but the reason is now readable on a phone.

## Phase B — the credits modal

Centered modal, `role="dialog"`, `aria-modal`, Escape to close, scrollable body, single Close
button. Content is authored copy, not a dump of `CREDITS-crops.txt`.

```
CREDITS

Crop sprites
"[LPC] Crops" by bluecarrot16, Daniel Eddeland, Joshua Taylor
and Richard Kettering. Commissioned by castelonia.
Licensed CC-BY-SA 3.0+ / GPL-3.0+.
opengameart.org/content/lpc-crops

Backdrop, props and shop texture
Original work by Vaclav Balak.

Font
Press Start 2P by CodeMan38, SIL Open Font License 1.1.

Sound
Synthesised in-browser; no sampled audio.

Game code © 2026 Vaclav Balak, MIT licensed.
```

The OGA URL is rendered as a real link (`target="_blank"`, `rel="noopener noreferrer"`) — the
licence requires a link back, and a non-clickable string is a weaker discharge of that obligation.

`CREDITS-crops.txt` stays in the repo as the full upstream record; the modal is the human-readable
summary of it.

## Phase C — `LICENSE` carve-out

Append to `LICENSE`, and mirror a two-line version in `README.md` under the existing `## License`
heading:

```
## Assets

The MIT licence above covers the source code only.

Crop sprites in `src/assets/crops/` derive from "[LPC] Crops" by bluecarrot16,
Daniel Eddeland, Joshua Taylor and Richard Kettering, and remain licensed
CC-BY-SA 3.0+ / GPL-3.0+. See `src/assets/crops/CREDITS-crops.txt`.

All other art in `src/assets/` is original work by the author, MIT licensed
with the code.
```

Share-alike applies to derivatives **of the crop art**, not to the game as a collective work — the
code stays MIT. The carve-out exists to state that boundary, not to relicense anything.

## Phase D — the cursor fix

Both chips gain a shared wrapper that picks its element from `useMediaQuery('(min-width: 640px)')`:

- **below 640px** — `<button>`, `aria-expanded`, current toggle behaviour unchanged
- **640px and up** — `<div>` with no role, no handler, no `aria-expanded`, and therefore the default
  cursor

`useMediaQuery` reads synchronously in its `useState` initialiser, so there is no first-paint flash
of the wrong element. Expanded state left over from a narrow viewport is harmless: at `sm` and up
the full labels render regardless of it.

The Reputation chip keeps its `title` tooltip; it is genuinely informational. The Day chip has none
today and gains none.

## Removals in the same pass

- `MuteToggle` no longer rendered from `HUD`; its `isMuted`/`setMuted` calls move into the menu row.
  The component file is deleted — the menu row is its only remaining caller.
- `AnalyticsOptOutToggle` no longer rendered from `App` on either branch. Component deleted; its
  DNT/consent logic moves into the menu row.
- The two `fixed`-position controls disappear from the bankruptcy screen entirely, which is the
  intent of the HUD-only scope decision.

## Edge cases

| Case | Behaviour |
|---|---|
| Menu open when a farm event or day summary modal opens | Popover closes; game modals own the screen |
| Restart armed, player closes the popover | Disarms. Reopening starts from the unarmed state |
| Restart from the tutorial's first day | `run_abandoned`'s existing day-1 guard applies unchanged (see 023 risks) — no new behaviour |
| DNT enabled mid-session | Not detectable without a reload; unchanged from today |
| Credits modal on a 375px viewport | Body scrolls; the OGA link wraps rather than overflowing |
| `localStorage` disabled | Mute and consent already fail soft; menu rows still toggle for the session |

## Testing

- **Menu**: gear renders in the HUD; popover opens/closes on click, Escape, and outside click;
  focus returns to the gear on close; rows carry `role="menuitem"`.
- **Two-step**: one activation of Restart does *not* reset the run; two does. Same for Replay
  tutorial, which additionally sets the onboarding replay flag.
- **DNT**: with `isDoNotTrack()` stubbed true, the analytics row is non-interactive and the
  explanatory sub-text is in the accessible tree (not only a `title`).
- **Credits**: modal renders the four attribution blocks; the OGA link has `rel="noopener
  noreferrer"`; `credits_viewed` fires exactly once per open.
- **Cursor fix**: with `matchMedia` stubbed at ≥640px, neither chip renders a `button`, and neither
  exposes `aria-expanded`; below 640px both do and both still toggle their labels.
- **Scope**: the bankruptcy screen renders no gear and no analytics chip.
- **Regression**: existing `MuteToggle` and `AnalyticsOptOutToggle` tests are rewritten against the
  menu rows rather than deleted — the behaviour they assert still exists, at a new address.

## Implementation phasing

| Phase | Content | Gate |
|---|---|---|
| A | Gear + popover + five rows; delete the two floating controls | tests green |
| B | Credits modal + `credits_viewed` event | tests green |
| C | `LICENSE` + `README` carve-out | — |
| D | Cursor fix | tests green, lint clean |

D is independent of A–C and can land first if the menu review runs long.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Mute becomes two taps** — a player who wants silence *now* has to find it | Accepted. Sound is off-by-default for nobody and is a set-once preference; the alternative is keeping a button on the play surface for a once-per-session action |
| **Mid-run restart is destructive and newly easy to reach** | Two-step arm, matching a pattern already in the game |
| **Attribution wording could still be wrong** if the crop sprites were in fact generated rather than LPC-derived | Confirmed with the author 2026-08-21: LPC-derived. If that ever proves wrong, the fix is deleting `CREDITS-crops.txt` and the modal block — a false attribution is its own defect |
| **Popover a11y regressions** are easy to ship and hard to notice | Focus-return and Escape are explicit test cases, not implementation details |

## Out of scope

- Moving **Last Turn** or **Next Day** — gameplay, deliberately left on the surface.
- A "wipe personal records" action. No demand, real footgun, contradicts the accumulate-failures
  design.
- Keyboard shortcuts for the menu.
- Localisation of the credits text.
