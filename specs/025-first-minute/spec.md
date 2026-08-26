# 025 — The First Minute: brighter frame, prominent tax, reframed failure

Status: **draft** (2026-08-21). Implements fixes #1, #2 and #3 of
[`70-DEEPDIVE.md` §3](../../../../game-ideas/70-DEEPDIVE.md) and the reframe in §4, against the
positioning locked in [`12-POSITIONING.md`](../../../../game-ideas/12-POSITIONING.md).

## Summary

The marketing deep-dive measured the game's first sixty seconds and found three problems, all in the
first ten of them: the opening frame is nearly black, the tax — the entire hook — is invisible until
it bites at ~60s, and nothing tells a player that going broke is the intended first outcome. The
one piece of real player feedback the project has (a tester who went bankrupt and felt they
*shouldn't have*) is diagnosed there as a **framing failure, not a difficulty one**.

This spec brightens the palette, promotes the tax to a first-class HUD element, and authors the
failure framing at both ends of the run — welcome modal and bankruptcy screen. The bankruptcy
screen also gains the evidence to say *why* the run ended, which requires the run's first `GameState`
addition since 022 — that piece (Phase C) is engine work, tracked and delivered separately from the
presentation change this PR carries (see **Delivery status** below).

**Explicitly not a balance change.** Per [`01-STRATEGY.md`](../../../../game-ideas/01-STRATEGY.md):
no economy tuning before 20 players' worth of data.

## Delivery status

This spec authors all four phases as one design; they ship on different tracks:

| Phase | Content | Status |
|---|---|---|
| A | Palette tokens + contrast pass | **Delivered** in the presentation PR |
| D | Framing copy (welcome modal + bankruptcy echo) | **Delivered** in the presentation PR |
| B | Tax indicator (desktop chip + mobile caption) | **Trialed and reverted.** The rate is constant and the concrete nightly charge already appears in the day-end summary, so a permanent HUD element added cognitive load and header space without new information. The Phase B sections below are kept as the record of what was tried and why it was pulled |
| C | Bankruptcy evidence line + death titles + `runHistory` (schema 11) | **Future work, separate branch.** Engine change, not part of the presentation delivery. The Phase C sections below are design-of-record for that branch, not a description of this PR |

## Problem

| # | Finding | Evidence |
|---|---|---|
| 1 | **Near-black first frame.** In-game it is a legitimate aesthetic; as a first impression and as a feed thumbnail it reads as unfinished or broken | §3.3; `farm-soil #4A2F1A`, `farm-ink #1A1A1A`, HUD `#0E0A04`, chips `#261808`, and the dominant `soil_tile.webp` |
| 2 | **The tax is dim on desktop and absent on mobile.** `Lease … Tax 6%` renders at `text-farm-stone/50` inside a `hidden sm:flex` wrapper | [`HUD.tsx:213`](../../src/components/HUD.tsx) |
| 3 | The tax is therefore **discovered as an ambush** in the Day 1 Summary at ~60s, rather than played against from second one | §3.2 |
| 4 | **Nothing sets the expectation that failure is normal.** The welcome modal is one cheerful line ending in an exclamation mark | [`OnboardingOverlay.tsx:253`](../../src/components/OnboardingOverlay.tsx) |
| 5 | **Bankruptcy cannot explain itself.** The screen shows generic advice from a hand-written `deriveInsight` ladder; the run's actual history is gone | [`BankruptcyScreen.tsx:24`](../../src/components/BankruptcyScreen.tsx); `GameState` keeps only `lastDailyLog` ([`types.ts:229`](../../src/engine/types.ts)) |
| 6 | The medal and reputation vocabularies say how *far* a player got, never *how they died* | [`medals.ts:30`](../../src/engine/medals.ts), [`reputation.ts:15`](../../src/engine/reputation.ts) |

On #5: PostHog already receives `tax_deducted` on every `day_completed`. The data exists in the
warehouse and nowhere in the running game — the bankruptcy screen cannot read it back.

## Goals

- A first frame that reads as a finished game in a feed of bright thumbnails.
- A tax indicator a player watches from second one, on every screen size.
- A first-run expectation of failure, set once, in the game's own voice.
- A bankruptcy screen that names the specific decision that cost the most, with evidence.

## Non-goals

- Any economy change: no tax rate, lease, crop price, or starting-coin adjustment.
- A forward "tomorrow's tax: −9" preview (see Decisions).
- Reworking the day-summary modal, the season transitions, or the share surface (`70-DEEPDIVE.md`
  §6 is a separate, later piece of work).
- Regenerating `ux-audit-screenshots/` — a dated audit record of 016, not a living fixture.

## Decisions (locked)

| Decision | Choice | Rationale |
|---|---|---|
| Brightening | **Permanent palette lift**, not an intro-only effect | A lift that decays makes the game look worse at second 10; §3.3's "reads as unfinished" applies to the whole session |
| `soil_tile.webp` | **Author regenerates it brighter and supplies the file** | It is the dominant dark area and unreachable by a token. A CSS filter would wash the pixel art and cannot be tuned per-region |
| Blocking | **Non-blocking.** Code ships without the new tile | A missing/unchanged `soil_tile` falls back to the flat page colour, which this spec is lifting anyway |
| Tax content | **`TAX 6%` — the rate, always. No charged amount, no forward preview** | A stable rate teaches the rule; the Day Summary already itemises the real charge. A preview computed from the current balance is **too low whenever a harvest is coming** ([`gameEngine.ts:605`](../../src/engine/gameEngine.ts) charges after lease *and* harvest), which errs in the one direction a dread indicator must not |
| Tax placement | **Own chip immediately right of the balance chip** at ≥640px | The tax attacks that specific number; adjacency carries the causality with no copy |
| Tax on mobile | **Appended to the balance chip's existing caption**: `Goal 200 · Tax 6%` | No new chip, no new row, no wrap risk on 375px. Mobile is first-class per P20 and the ICP |
| Bankruptcy evidence | **Add per-day run history to `GameState`; schema 10 → 11** | ~80 objects of three numbers is negligible, and the specificity *is* the fix |
| Death titles | **New five-entry cause-of-death vocabulary**, alongside the medal | Medals answer "how far"; the punchline has to answer "how you died" |
| Failure framing | **Welcome modal + a short bankruptcy echo**, authored once | Two ends of the same sentence, not two different voices |

## Phase A — palette lift

Starting values, to be tuned against side-by-side screenshots before merge — these are a direction,
not a result:

| Token / literal | Now | Proposed | Where |
|---|---|---|---|
| `farm.soil` | `#4A2F1A` | `#5E3D22` | modal/panel bodies + bankruptcy background |
| Page backdrop | `#140E06` | `#241806` | `PageBackdrop.tsx` — the flat colour behind `soil_tile.webp` |
| `farm.ink` | `#1A1A1A` | `#241C14` | stat rows, panels — also warms a flat neutral |
| HUD bar | `#0E0A04` | `#1C1208` | `HUD.tsx` header |
| Chip body | `#261808` | `#33220E` | every HUD chip, ~12 call sites |
| Chip border | `#5C3D1E` | `#7A5228` | ditto |
| Chip hover | `#3A2510` | `#4A3016` | ditto |

The literals are repeated across `HUD.tsx` and neighbours — measured on the merged tree:
`#5C3D1E` 22 times in 7 files, `#261808` 12 times in 5, `#3A2510` 6 times in 5, `#0E0A04` twice.
**Lift them into Tailwind tokens** in the same pass (`farm.chip`, `farm.chipBorder`,
`farm.chipHover`, `farm.bar`, and `farm.page` — the flat colour behind the tiled soil backdrop) so
the next tuning round is one file, not twelve.

Two literals are deliberately **not** in scope: `#4A2F1A` in `Shop.tsx` (an awning stripe, not a
background) and `#EB6A5C` (a foreground that gets re-derived from the contrast pass below).

### Contrast is an acceptance criterion, not an afterthought

[`HUD.tsx:74`](../../src/components/HUD.tsx) carries an explicit note pinning the critical-balance
red at `#EB6A5C` for ≥4.5:1 **against `#261808`**. Raising the background invalidates that
calculation and several others. Re-verify and adjust, at minimum:

- `#EB6A5C` critical balance on the new chip body
- `text-farm-stone/50` lease text — expect this to need `/70` or `/80`
- `text-farm-parchment/70` chip captions
- `farm-gold #F5C842` values on the new chip body
- `text-farm-stone` labels on the new `farm-ink`

Lighthouse a11y and the existing axe assertions must stay green. **Expect the low opacities to be
the casualties** — a `/50` that passed on near-black will not pass on a lifted background.

### Marketing screenshots

Regenerate the five exports named in
[`50-C17-ASSETS.md`](../../../../game-ideas/50-C17-ASSETS.md) — `bankruptcy.png`, `mobile-375.png`,
`planted-grid.png`, `next-day.gif`, `cover-630x500.png` — from the lifted build. That document's
manual "brighten every asset in Preview" step should become unnecessary; if it does not, the lift
did not go far enough.

## Phase B — the tax indicator

> **Reverted.** See **Delivery status** above. This section is retained as the record of the trialed
> design; the tax indicator is not present in the shipped HUD.

### Desktop (≥640px)

A real chip, same construction as its neighbours, immediately right of the balance chip:

```
[Day 3 / 20  ] [🪙 127          ] [📉 TAX 6%] [🎖️ Apprentice Farmer]
[Season 1 · Spring] [Goal 200 by day 20]
```

- Chip body/border tokens, `farm-gold` value — **not** `text-farm-stone/50` chrome text.
- `aria-label`: *"Tax: 6% of your coins is taken every night."*
- **Pulses** on the turn tax is charged: trigger when `lastDailyLog.day` changes and
  `taxDeducted > 0`. One pulse, ~600ms, suppressed under `useReducedMotion()`.

The old `Lease … Tax …` block keeps **Lease only**, including its end-of-season *"rises to N next
season"* preview. The `Tax 6%` span is removed from it — the chip replaces it, and showing both
would be the same fact twice at two different weights.

### Mobile (<640px)

No new chip. The balance chip's caption becomes:

```
Goal 200·D20 · Tax 6%
```

The existing late-season warning (`— N days left`, [`HUD.tsx:191`](../../src/components/HUD.tsx))
still appends after it, so the ordering is `goal · tax · warning`. If all three plus the warning
overflow 375px, **the goal abbreviates further; the tax does not** — it is the element this phase
exists to make visible.

## Phase C — bankruptcy reframe

> **Future work, separate branch.** See **Delivery status** above. This is engine/schema design of
> record for a later branch, not part of the presentation delivery.

### C1 — run history (`SCHEMA_VERSION` 10 → 11)

```ts
/** 025 — one record per completed day, retained for the end-of-run post-mortem. */
export interface RunDayRecord {
  day: number;
  /** Balance carried overnight, i.e. what the tax was charged against. */
  closingBalance: number;
  taxDeducted: number;
  /** Gross crop sales this day, before lease and tax. */
  harvestIncome: number;
  /** Plots unlocked at end of day — an increase marks a plot purchase. */
  unlockedPlots: number;
  /** Buildings owned at end of day — an increase marks a building purchase. */
  buildingCount: number;
}
```

**Why six fields and not three.** The first draft of this spec recorded only day, closing balance
and tax, which cannot support two of the five titles in C3: `fed_the_taxman` compares cumulative tax
against gross harvest income, and `overextended` needs to know *when* a plot or building was bought.
Neither purchase is timestamped anywhere in `GameState`, so recording the running counts per day is
the cheapest way to make the heuristic derivable from history alone, with no new engine bookkeeping.

`GameState.runHistory: RunDayRecord[]`, appended once per completed day, cleared by
`initialGameState`. Bounded in practice by the run length; no cap needed (endless mode grows it, and
six numbers a day is not a storage concern).

**Both log-write sites must append.** `nextDay()` writes `lastDailyLog` twice — once on the
bankruptcy early return (`gameEngine.ts:591`) and once on the normal path (`gameEngine.ts:698`). If
only the normal path appends, the fatal day never reaches history, which is precisely the day
`weathered_out` and `idle_hands` are judged on.

Migration follows the established chain in
[`useGameEngine.ts:236`](../../src/engine/useGameEngine.ts) — a v10 → v11 branch seeding
`runHistory: []`. In-flight v10 runs therefore reach bankruptcy with no history and fall back to
`deriveInsight` (below), which is correct: we cannot invent evidence for days we did not record.

### C2 — the evidence line

Replaces the **content** of the existing Insight box; the box itself stays.

> **You held 240 coins overnight on days 6–9. The taxman took 71.**

Derived from `runHistory`: the longest run of consecutive days whose `closingBalance` sat in the top
quartile of the run, plus the summed `taxDeducted` across those days. `deriveInsight` is **kept as
the fallback** for runs too short to have a story (fewer than five recorded days — i.e. days 1–4
fall back) and for migrated
saves with an empty history — a player who died on day 2 has no pattern to name, and generic advice
beats a fabricated one.

### C3 — cause-of-death titles

Five entries, evaluated in priority order against `runHistory` + `lastDailyLog`. Rendered above the
medal badge, which stays.

| Id | Condition | Title |
|---|---|---|
| `fed_the_taxman` | Cumulative `taxDeducted` ≥ 25% of the run's gross harvest income | **Fed the Taxman** |
| `weathered_out` | Final day carried a disaster (pest / blight / flash drought) | **Weathered Out** |
| `overextended` | A plot or building was bought within the last 3 days | **Bought the Farm** |
| `idle_hands` | Majority of unlocked plots empty on the final day | **Idle Hands** |
| — | default | **Out of Seed Money** |

Thresholds are first-pass and tunable; the ordering matters more than the numbers, and the ordering
is *most interesting cause first*. These are punchlines, not scores — they exist because
[`10-ICP.md`](../../../../game-ideas/10-ICP.md) identifies the shareable unit as "a specific, funny,
legible failure," not a high score.

#### Observed baseline distribution (deferred tuning)

Simulated with `npm run sim -- --strategies smartMixed --trials 500` (seed 42). Percentages are of
bankrupt runs per config, not of all trials.

| config | bankrupt | fed_the_taxman | weathered_out | overextended | idle_hands | out_of_seed_money |
|---|---|---|---|---|---|---|
| baseline | 2 | 0% | 0% | 0% | 100% | 0% |
| proposed | 142 | 0% | 19% | 20% | 49% | 12% |
| buildings019 | 195 | 0% | 17% | 15% | 62% | 6% |
| events022 | 184 | 0% | 16% | 12% | 67% | 5% |

This is the **baseline for the next tuning pass**, not a tuned result. It reflects only the
`smartMixed` bot, which reinvests rather than hoards — so `fed_the_taxman` (cumulative tax ≥ 25% of
gross harvest income) firing at 0% is expected for this strategy, not a broken threshold; the
hoarding players that title targets are outside the bot's behaviour. `idle_hands` dominating (62–67%
on the fuller-economy presets) reflects that a reinvesting bot's board goes empty on the day it can
no longer afford seeds, which overlaps with `out_of_seed_money`. Thresholds are left first-pass per
the design note above; tuning waits until real-run data exists. `baseline`'s 2 bankrupt runs are too
few to read.

## Phase D — the framing copy

### Welcome modal

Replaces the single line at [`OnboardingOverlay.tsx:253`](../../src/components/OnboardingOverlay.tsx):

> Grow crops. Sell 'em. Don't go broke.
>
> **Most people go broke the first time. That's the game.**
>
> Let's fill your farm with radishes.

The current copy's closing exclamation mark reads cheery;
[`11-BEACHHEAD.md`](../../../../game-ideas/11-BEACHHEAD.md) is explicit that cosy language repels the
beachhead. The middle line is the highest return-per-minute change in the whole deep-dive.

### Bankruptcy echo

One line under the death title — a confirmation, not a repeat of the sentence:

> Told you. Again?

Sits directly above the existing Restart button, which already provides the one-tap retry
`70-DEEPDIVE.md` asks for.

## Edge cases

| Case | Behaviour |
|---|---|
| v10 save reaches bankruptcy | Empty `runHistory` → `deriveInsight` fallback, default death title |
| Bankrupt on day 1–3 | Too short for C2 → fallback; title still derives from `lastDailyLog` |
| Endless mode, 200+ days | `runHistory` grows unbounded but stays trivial in size; C2's top-quartile window scales with it |
| `prefers-reduced-motion` | Tax chip does not pulse; all other behaviour unchanged |
| Tutorial active on day 1 | Tax chip renders as normal — it is the thing we want seen first |
| Player skips the tutorial | Framing line is missed. Accepted: the bankruptcy echo still lands, and skippers are self-selected |

## Testing

- **Palette**: automated contrast assertions for all ten foreground/background pairs the harness
  gates (Phase A names a representative subset "at minimum"; the harness expands it to the full ten);
  existing axe tests stay green.
- **Tax chip**: renders at ≥640px with the rate; pulses once when `lastDailyLog.day` advances with
  `taxDeducted > 0`; does not pulse under reduced motion; the old `Tax 6%` chrome span is gone.
- **Tax on mobile**: below 640px no chip renders and the balance caption contains `Tax 6%`, with the
  late-season warning still appended after it.
- **Migration**: a v10 envelope loads, gains `runHistory: []`, and does not crash the bankruptcy
  screen.
- **`runHistory`**: one record appended per `nextDay()`; cleared by `restart()`.
- **C2**: a fixture run holding a high balance across days 6–9 produces the expected day range and
  tax sum; a 2-day run falls back to `deriveInsight`.
- **C3**: one fixture per title, plus a fixture proving priority order (a tax-heavy run that also
  ended on a disaster resolves to `fed_the_taxman`).
- **Copy**: welcome modal renders three lines and contains no exclamation mark.

## Implementation phasing

| Phase | Content | Gate |
|---|---|---|
| D | Framing copy | tests green — smallest, most valuable, ships first · **delivered** |
| B | Tax chip + mobile caption | tests green · **trialed and reverted** (see Delivery status) |
| A | Palette tokens + contrast pass | contrast assertions green, **screenshots reviewed by the author** · **delivered** |
| C | Schema 11 + evidence line + death titles | tests green, migration test green · **future work, separate branch** |

D and A are the presentation phases that ship here; A is the one needing a human look before merge.
B was reverted and C is a separate engine branch.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| **The lift ruins the aesthetic.** This is the riskiest item in the batch and the only one that is a matter of taste | Tokenised, so a revert is one file. Author reviews before/after screenshots as an explicit merge gate |
| **Contrast regressions ship silently** — the current a11y comments encode calculations against the *old* backgrounds | Named pairs are test cases, not a manual checklist |
| **`soil_tile.webp` never arrives**, leaving the backdrop at odds with the lifted chrome | Fallback is the lifted flat colour, which is coherent on its own. Phase A does not block on the asset |
| **C2's heuristic names the wrong villain** on an unusual run | The line is evidence-shaped, not accusatory ("you held X on days Y" is a fact from the log). Fallback covers the cases with no clear pattern |
| **`TAX 6%` teaches the rule but not the magnitude** — a rate is an abstraction a player must do arithmetic on | Accepted, at the author's direction. The Day Summary already delivers the concrete number; the chip's job is to make it *expected*. Revisit if playtesters still describe the tax as a surprise |
| **Schema 11 discards nothing but touches the migration chain** | The chain has seven working branches and full test coverage; this adds an eighth of the simplest kind |

## Out of scope

- The share / "Copy result" button (`70-DEEPDIVE.md` §6) — real, valuable, separate.
- The `feedback_answered` two-button ask (§4) that would tell us whether this reframe *worked*.
  It measures this spec and should follow it, not ship inside it.
- Any change to the Day Summary modal's contents.
- Achievements (G14 in [`backlog.md`](../../backlog.md)) — the death titles are deliberately *not*
  persisted or collected. If they should become collectible, that is G14's job.
