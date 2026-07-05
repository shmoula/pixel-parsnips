# UX Audit Fixes — Critical & High Findings

**Date**: 2026-07-05
**Source**: Hands-on UX audit of 2026-07-05 (desktop 1280×800; mobile 375×812 and 390×844)
**Branch**: implemented on `016-ux-ui-polish-2` — no new branch

## Overview

The audit found ten critical/high issues that break the first-time mobile experience, undermine the player's ability to understand the game's economy, and let players stumble into unfair losses without warning. This feature fixes them, with one piece — the per-plot fertility wear indicator — deferred (see Out of Scope). It deliberately changes **presentation, feedback, and guardrails only** — no game-balance values (tax rate, lease costs, fertilizer price, exhaustion timing) change.

## User Scenarios & Testing

### User Story 1 - Mobile first-run tutorial works end to end (Priority: P1)

A brand-new player on a phone (375×812) starts the game and completes the "Your First Harvest" tutorial without ever losing sight of what to do next. Every tutorial instruction bubble and highlight is fully visible on screen at every step, and the skip control never covers another control.

**Why this priority**: The audit found the tutorial's "buy radishes" instruction bubble and its gold highlight ring rendered *below the visible screen* (measured at y=873 and y=927 in an 812px-tall viewport) because the highlight anchors to the shop panel's position from before its slide-up animation finished. The audit also caught the shop panel closing itself immediately after opening once, stranding the step. Separately, the floating "Skip ✕" chip sits directly on top of the right edge of the primary "PLANT SEEDS FIRST →" button in the bottom bar — taps intended for the main action hit Skip instead. The first 30 seconds on mobile are broken; this is the single highest-impact fix.

**Independent Test**: On a fresh save at 375×812, play the tutorial from welcome card to payoff popup using only taps. At each step, verify the instruction bubble and highlight are fully inside the viewport, and verify the Skip control's hit area does not intersect any other interactive element.

**Acceptance Scenarios**:

1. **Given** a fresh save on a 375×812 viewport, **When** the player opens the shop during the "buy radishes" tutorial step, **Then** the instruction bubble and the highlight ring around the radish card are fully visible within the viewport once the shop panel finishes opening.
2. **Given** any tutorial step on any supported viewport (375×812 through desktop), **When** the step's anchored element moves, resizes, or animates into place, **Then** the highlight and bubble reposition to match its final on-screen location.
3. **Given** the tutorial is active on mobile, **When** the player views the bottom action bar, **Then** the Skip control does not visually overlap or intercept taps meant for the shop or next-day buttons.
4. **Given** the player opens the shop during the "open the shop" step, **When** the shop panel finishes opening, **Then** it stays open until the player closes it or the tutorial intentionally closes it at the planting step.
5. **Given** the "buy radishes" step is active, **When** the player buys seeds one at a time, **Then** the instruction reflects remaining progress toward the goal (e.g., how many more seeds are needed).

---

### User Story 2 - The daily money math adds up (Priority: P1)

A player reads the end-of-day summary and can reproduce every number in it with simple arithmetic: what the harvest earned, what the lease cost, what the tax was charged **on**, and what the net change was.

**Why this priority**: The summary labels the daily levy "Tax (6%)" and places it directly under the harvest line, but the amount is 6% of the player's total coin balance, not of the harvest. Day 1 of the audit read: Harvest +48, Tax (6%) −8 — while 6% of 48 is 3. On a no-harvest day the summary showed Harvest +0, Tax −7. A player who checks the math concludes the game is wrong or hiding something. "Why did I lose money?" is unanswerable today, and it is the core question of a tycoon game.

**Independent Test**: Advance several days with varied harvests (including zero-harvest days) and verify each summary line item states its basis clearly enough that the shown amount can be independently recomputed from visible numbers.

**Acceptance Scenarios**:

1. **Given** a day ends with any coin balance, **When** the player reads the tax line in the day summary, **Then** the label communicates that the tax is charged on their savings/balance (not the harvest), and the shown amount matches that basis.
2. **Given** a day ends with no harvest, **When** the player reads the summary, **Then** the tax line still makes sense on its face (a levy on savings) rather than appearing as a percentage of a 0-coin harvest.
3. **Given** a new player encounters their first tax deduction, **When** the summary shows it, **Then** a one-time short explanation of how the tax works is available at that moment (shown once, not every day).

---

### User Story 3 - Exhaustion is announced clearly and fertilizer guidance is honest (Priority: P2)

When plots exhaust, the player notices it as a distinct event — not a buried log row. When a plot is resting, the player can make an informed choice between waiting for free recovery and spending on fertilizer.

**Why this priority**: In the audit, all four starting plots exhausted simultaneously on Day 5 and the only notice was buried rows in the day summary. Worse, every exhausted plot displays a "Buy Fertilizer in the shop" prompt even when the plot recovers for free the next day; the auditor (like a real player) wasted 30🪙 on a plot that was 1 day from free recovery. The current UI actively steers players into a bad purchase. (A per-plot fertility wear indicator that would foreshadow exhaustion *before* it happens is deferred — see Out of Scope.)

**Independent Test**: Harvest plots until they exhaust; verify the day summary announces the exhaustion distinctly, then compare the guidance shown on plots at 1 day vs. 3 days from recovery, with and without fertilizer owned.

**Acceptance Scenarios**:

1. **Given** one or more plots exhaust at end of day, **When** the day summary appears, **Then** the exhaustion is presented as a distinct, noticeable event (not visually identical to ordinary log rows).
2. **Given** an exhausted plot that recovers tomorrow, **When** the player views it, **Then** the plot communicates "ready tomorrow" and does not push a fertilizer purchase.
3. **Given** an exhausted plot with 2+ days of rest remaining and the player owns no fertilizer, **When** the player views it, **Then** the message presents fertilizer as an optional trade-off (days saved vs. cost), not as the required next step.

---

### User Story 4 - Tapping an empty plot always responds (Priority: P2)

A player who taps an empty plot labeled "click to plant" always gets a response: either planting happens (seed selected) or the game visibly guides them toward getting seeds.

**Why this priority**: Today, tapping an empty plot with no seed selected does nothing at all — no message, no animation, no redirect. The plot's own label ("click to plant") promises an action the game silently refuses. This is the most likely post-tutorial dead end for a new player.

**Independent Test**: With no seed selected, tap an empty plot on both mobile and desktop and verify a visible, helpful response occurs within a moment of the tap.

**Acceptance Scenarios**:

1. **Given** no seed is selected and the player has no seeds in inventory, **When** they tap an empty plot, **Then** the game visibly directs them toward acquiring seeds (e.g., draws attention to the shop) with a short explanatory message.
2. **Given** no seed is selected but the player owns seeds, **When** they tap an empty plot, **Then** the game prompts them to choose which seed to plant, or otherwise makes the selection step obvious.
3. **Given** a seed is selected, **When** they tap an empty plot, **Then** planting occurs immediately (unchanged current behavior).

---

### User Story 5 - No silent slide into bankruptcy (Priority: P2)

A player approaching financial ruin is clearly warned before each decision that could end the run, understands what an empty day will cost, and is told when a run has become unwinnable.

**Why this priority**: The "Nothing's planted — advance anyway?" confirmation appears only **once per session**; after confirming it a single time, the player can click through repeated empty days and silently drain into bankruptcy. The dialog also never states the cost of an empty day. And when the balance falls below the cheapest seed price with nothing growing, the run is mathematically lost — but the game says nothing, letting the player click through several hollow days to the bankruptcy screen. Failure should teach, not ambush.

**Independent Test**: Drive a save toward zero coins via empty days and verify each guardrail fires: cost shown in the confirmation, confirmation repeating when the stakes are ruinous, and an unwinnable-state notice appearing when recovery is impossible.

**Acceptance Scenarios**:

1. **Given** nothing is planted, **When** the player tries to advance the day, **Then** the confirmation states the concrete cost of doing so (lease and tax) before they commit.
2. **Given** the player has previously confirmed an empty day this session, **When** advancing empty again would drop the balance below a survival threshold (e.g., under one further day of lease), **Then** the confirmation appears again rather than being skipped.
3. **Given** the balance is too low to buy any seed and nothing is growing, **When** the player returns to the farm, **Then** the game plainly tells them the run cannot recover and offers the path forward (advance to the end / restart).
4. **Given** the advance-day control shows "Plant seeds first" while advancing is actually possible via confirmation, **When** the player reads the control, **Then** its label matches what it actually does (skipping a day at a cost) instead of implying a hard block.

---

### User Story 6 - Disaster reports match what actually happened (Priority: P2)

When a disaster strikes, the announcement matches the visible damage on the farm — every destroyed plot is accounted for, and the framing matches the actual loss.

**Why this priority**: In the audit, a pest infestation visibly destroyed four plots, but the disaster banner reported only "Plot #1 destroyed by pests." (the event log recorded a single plot while the farm state flagged all four). The same modal was headlined "Quiet day — no harvests." directly above a "DISASTER!" banner. Feedback the player can visibly disprove destroys trust in all other feedback.

**Independent Test**: Trigger a pest infestation with multiple crops growing and verify the report lists all destroyed plots; trigger disasters on no-harvest days and verify the messaging is coherent.

**Acceptance Scenarios**:

1. **Given** pests destroy N plots overnight, **When** the day summary appears, **Then** the disaster report accounts for all N plots (individually or as an accurate count), matching the farm's visible state.
2. **Given** a disaster occurs on a day with no harvests, **When** the summary appears, **Then** the "quiet day" framing and the disaster framing are not shown together in a contradictory way.

---

### User Story 7 - Mobile plot cards fit their content (Priority: P2)

A player on a phone can read every plot's full status — crop name, time remaining, and state — without any text, badge, or indicator being cut off.

**Why this priority**: At 375×812 and 390×844 the audit measured plot-card content clipping: the growing-crop time badge was cut off at the bottom (badge bottom 224px vs. card bottom 219px at 390×844), the progress ring clipped at the card edge at 375px, the exhausted-plot guidance truncated mid-sentence, and the pest "Clear Plot" button label truncated. The plot card is the game's primary object; on phones it is currently illegible in exactly the states where the player most needs information.

**Independent Test**: On 375×812 and 390×844, put plots into every state (empty, each growth stage, ready, exhausted with/without fertilizer, pest-damaged, locked, purchasable) and verify all content renders fully inside each card.

**Acceptance Scenarios**:

1. **Given** any plot state on a 375×812 or 390×844 viewport, **When** the player views the farm grid, **Then** no text, badge, progress indicator, or button inside a plot card is visually clipped or truncated.
2. **Given** the farm grid layout changes to achieve this, **When** the player views the whole screen, **Then** the grid still fits without horizontal scrolling and interactive elements retain comfortable touch sizes.

---

### User Story 8 - The season goal reads as a goal, not an achievement (Priority: P3)

A player understands from the HUD that the season target is a balance they must **hold at the end of the season**, and can tell at a glance whether they are on track.

**Why this priority**: The HUD shows "130 / 105 target" in success styling from the first minute of play — the fraction format plus green color reads as "goal already achieved," while ~19 days of lease drain still stand between the player and actually passing. The tutorial's "now hit your season target" lands nonsensically when the HUD says it is already hit. On mobile the word "target" is dropped entirely ("130 / 105"), leaving the second number unexplained. Lower priority because it misleads early but corrects itself through play.

**Independent Test**: Start a fresh season and verify the HUD communicates the deadline nature of the target on day 1 on both desktop and mobile widths; verify success styling appears only when passing is genuinely secured or clearly framed as "currently above target."

**Acceptance Scenarios**:

1. **Given** day 1 of a season with a starting balance above the target, **When** the player reads the HUD, **Then** the presentation communicates that the target must be met at the season's end (e.g., includes the deadline) rather than reading as already achieved.
2. **Given** the mobile-width HUD, **When** the player reads the balance chip, **Then** the meaning of the target number is still discoverable (short label, icon, or tap-to-expand), not a bare second number.
3. **Given** any day mid-season, **When** the player checks the HUD, **Then** they can tell whether they are ahead of or behind the pace needed to end the season above target.

---

### Edge Cases

- Tutorial on a device with reduced-motion enabled: highlights must still position correctly when the shop panel appears without animation.
- Tutorial anchor element scrolled out of view (player scrolls mid-step): bubble must remain on-screen and point the player back.
- Player skips the tutorial mid-step on mobile: skip must work from every step without leaving overlays behind.
- Fertilizer owned while viewing a plot 1 day from recovery: the "use fertilizer" action may remain available but must not be presented as the recommended choice.
- Empty-day confirmation when the balance is exactly equal to the day's lease: treat as ruinous (warn again).
- Unwinnable-state notice when a crop is still growing but coins are below seed price: the run is *not* yet unwinnable (tomorrow's harvest may save it) — the notice must not fire.
- Pest disaster that destroys zero plots (nothing was growing): no destroyed-plot lines; framing must not overstate the event.
- Season target chip during endless mode ("Deep Winter"): deadline framing must still make sense with rolling seasons.
- Very long plot-state strings for future crops or copy changes: cards must degrade by wrapping or abbreviating, never by silent clipping.

## Requirements

### Functional Requirements

**Tutorial (US1)**

- **FR-001**: Tutorial instruction bubbles and highlights MUST be fully visible within the viewport at every step on all supported viewport sizes (375×812 and up), including after any panel open/close animation completes.
- **FR-002**: Tutorial highlights MUST track their anchor's final position whenever the anchor moves, resizes, or finishes animating.
- **FR-003**: The tutorial skip control MUST NOT overlap or intercept input intended for any other interactive element on any supported viewport.
- **FR-004**: The shop panel MUST remain open once opened during the tutorial until the player closes it or the tutorial's planting step begins.
- **FR-005**: The "buy radishes" step MUST show remaining progress toward the seed-count goal as the player buys.

**Economy legibility (US2, US8)**

- **FR-006**: The day summary's tax line MUST identify the basis the tax is charged on, and the displayed amount MUST be recomputable by the player from visible numbers.
- **FR-007**: The first time a tax deduction appears in a run, the game MUST offer a one-time plain-language explanation of how the tax works.
- **FR-008**: The HUD season-goal display MUST communicate that the target is an end-of-season deadline, on all viewport sizes, including a discoverable label for the target number on mobile widths.
- **FR-009**: Success styling for the season goal MUST NOT present the target as achieved while the season outcome is still undecided, unless the framing makes the "currently above target" meaning explicit.

**Plot lifecycle (US3)**

- **FR-010**: *(deferred — per-plot fertility indicator; see Out of Scope. Number kept so later FR IDs stay stable.)*
- **FR-011**: Plot exhaustion events in the day summary MUST be visually distinct from routine log rows.
- **FR-012**: An exhausted plot that recovers within 1 day MUST communicate the free recovery and MUST NOT solicit a fertilizer purchase.
- **FR-013**: An exhausted plot with longer recovery MUST present fertilizer as an explicit trade-off (cost vs. days saved).

**Interaction feedback (US4, US5)**

- **FR-014**: Tapping an empty plot with no seed selected MUST produce visible, immediate guidance toward the correct next step (acquiring or selecting seeds); silent non-response is not acceptable.
- **FR-015**: The empty-day confirmation MUST state the concrete coin cost of advancing with nothing planted.
- **FR-016**: The empty-day confirmation MUST re-arm (appear again despite prior confirmation) whenever advancing empty could not be survived for at least one further day.
- **FR-017**: When the player cannot afford any seed and nothing is growing, the game MUST inform them that the run cannot recover and present their options.
- **FR-018**: The advance-day control's label MUST accurately describe its behavior in the nothing-planted state (a costed skip, not a hard block).

**Disaster integrity (US6)**

- **FR-019**: Disaster reports MUST account for every plot affected by the event, matching the post-event farm state.
- **FR-020**: Day summaries MUST NOT simultaneously present contradictory framings (e.g., "quiet day" alongside a disaster) for the same day.

**Mobile layout (US7)**

- **FR-021**: All plot-card content (text, badges, progress indicators, buttons) MUST render fully within card bounds in every plot state at 375×812 and 390×844.
- **FR-022**: Any farm-grid layout change MUST preserve no-horizontal-scroll behavior and touch-target sizes of at least the platform minimum (44px) for interactive elements.

### Key Entities

- **Tutorial step**: A stage of the first-run flow with an anchored instruction (target element, copy, completion goal); its on-screen placement is derived from the anchor's live position.
- **Day summary entry**: The per-day record shown to the player — weather, harvests, disaster effects, exhaustion events, market lines, and the accounting rows (harvest, lease, tax, net) with their bases.
- **Plot status**: A plot's player-visible state: emptiness, crop and growth progress, exhaustion/recovery countdown, pest damage, locked/purchasable.
- **Run-risk state**: The derived condition driving guardrails — cost of an empty day, survivability after it, and whether recovery is possible at all.

## Success Criteria

### Measurable Outcomes

- **SC-001**: On a 375×812 device, 100% of tutorial steps display their instruction and highlight fully on screen, verified across 10 consecutive fresh-save runs (including with reduced motion enabled).
- **SC-002**: Zero overlapping interactive elements in the tutorial across supported viewports (no tap on a visible control triggers a different control).
- **SC-003**: A first-time player can correctly answer "why did your balance change last night?" using only the day summary — every accounting line's amount can be recomputed from information visible in the summary.
- **SC-004**: Following on-screen guidance never spends fertilizer on a plot that recovers within 1 day — the UI never recommends it in that state.
- **SC-005**: 100% of empty-plot taps produce a visible response within a perceptible instant (~100ms) in manual testing across mobile and desktop.
- **SC-006**: In a scripted run toward bankruptcy, every ruinous empty-day advance is preceded by a costed confirmation, and the unwinnable notice appears on the first day recovery becomes impossible.
- **SC-007**: After a multi-plot pest event, the disaster report's destroyed-plot count matches the number of pest-damaged plots on the farm in 100% of test runs.
- **SC-008**: Zero clipped or truncated plot-card content across all plot states at 375×812 and 390×844 (visual regression check).
- **SC-009**: On day 1 of a season, the HUD's season-goal presentation explicitly states the deadline (e.g., "by Day 20") on both desktop and mobile widths, and applies no unqualified success styling while the season outcome is undecided.

## Assumptions

- **Presentation only, no rebalancing**: All fixes change labels, layout, feedback, and guardrails. The tax rate and basis (6% of balance), lease costs, fertilizer price/effect, exhaustion thresholds and recovery times, and disaster probabilities are unchanged. If playtesting later shows the *mechanics* (not their presentation) are the problem, that is a separate feature.
- **Pest report fix corrects the record, not the damage**: The under-reporting is treated as an event-logging defect; the actual gameplay damage (which plots get destroyed) already behaves as designed and is unchanged.
- **"Survival threshold" for re-arming the empty-day confirmation** (FR-016) defaults to: the balance after the empty day could not cover one further day of lease. The exact threshold may be tuned during planning without changing the requirement's intent.
- **Season pace indicator** (US8, scenario 3) may be satisfied by simple deadline framing (e.g., "by Day 20") plus existing danger states; a full pace/projection meter is optional scope.
- **Existing "days left" warning** (shown in the final 3 days of a season when below target) remains and is complementary to the new framing.
- **Tutorial one-off race** (the shop sheet closing itself right after opening) is covered by FR-004's "stays open" guarantee regardless of its root cause.
- **Medium/low audit findings are out of scope** (e.g., weather forecast, purchase confirmations/undo, harvest juice, modal stacking at season end, visual glow-up backlog) and can be specced separately.

## Out of Scope

- Per-plot fertility/wear indicator (foreshadowing exhaustion before it happens) — trimmed from this feature (was FR-010); candidate for a follow-up spec.
- The visual "glow-up" backlog from the audit (skeuomorphic stall, board dressing, juice/particles, typography system).
- Weather forecasting, purchase confirmation/undo flows, market-announcement persistence, bankruptcy-screen stat dedup — medium-severity findings deferred.
- Any change to economy tuning, difficulty, or the balance simulator.
- Sound effects, haptics, or new game mechanics (e.g., mercy/rescue mechanics beyond the unwinnable-state notice).
