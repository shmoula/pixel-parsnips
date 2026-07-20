# 021 — Harvest Moment Juice (F1)

> Backlog item **F1** (Game Feel & Polish): "Juice pass — harvest moment — coins fly
> to HUD with animation; counter ticks rapidly; per-crop harvest sounds." Source:
> p2·E. Priority Medium, Effort M. Precondition ("validate after G1 ships") long met.

Status: **Spec** — 2026-07-19.

## 1. Goal

Make the harvest payoff *land*. Today the coin balance silently changes behind the
dimmed Day Summary overlay — there is no moment. After this feature: the HUD holds
the old balance while the player reads the summary, and when they close it, coins fly
from the harvested plots to the HUD balance chip, the counter rapid-ticks up to the
new balance, and each crop fires its own chiptune harvest sound.

This is a pure **game-feel / presentation** change, in the mold of 013.

### Non-goals

- No engine, balance, or schema change. `npm run sim` is not involved. All data
  needed already exists on `DailyLogEntry` (`harvests[]`, `openingBalance`,
  `closingBalance`).
- No plant/purchase/UI-click sounds, no background music (future items).
- No change to the 013 disaster reveal, the streak chip, or F3 weather tints.
- No analytics events.
- No new dependencies (Web Animations API + Web Audio API, both native).

## 2. Trigger conditions

The celebration plays when the **auto-opened** Day Summary modal is closed (by any
means: Continue, Escape, overlay click) **and all** of:

| Condition | Why |
|---|---|
| `log.harvests.length > 0` | Quiet days stay quiet. |
| Fresh open (`animateReveal === true`) | "Last Turn" reopens replay nothing — same rule as 013. |
| `state.phase === 'playing'` after the turn | Season-boundary turns hand the stage to `SeasonTransitionModal`, so the coin flight is skipped; bankruptcy unmounts the board entirely. **The harvest chime still plays** on season-boundary harvest turns (sound-only) — see §3. |

While the auto-opened modal is up **and a celebration is pending**, the HUD balance
chip displays `log.openingBalance` (the pre-turn balance) instead of the committed
balance — the reveal is saved for the celebration. In every other case the HUD shows
the committed balance exactly as today.

## 3. Behavior — the celebration sequence (~1.5–2s, always skippable)

1. **t=0** — modal closes. For each entry in `log.harvests`, a group of coin sprites
   (🪙) spawns at that plot's on-screen position. Coins per plot scale with yield:
   `clamp(ceil(adjustedYield / 16), 1, 4)` (radish ≈1, parsnip ≈2, pumpkin ≈4), hard
   cap **20 coins total** (excess trimmed evenly across plots).
2. **Group launches** — groups launch in plot order, staggered ~140ms apart. Each
   launch plays that crop's harvest sound. With many plots the stagger compresses so
   the last launch starts by ~900ms.
3. **Flight** — each coin arcs to the HUD balance chip over ~600ms (slight curve,
   ±20px random spread, ease-in), implemented with the Web Animations API
   (`element.animate`) on absolutely-positioned sprites inside a `pointer-events-none`
   fixed portal overlay (above the board, `z-[60]`).
4. **Landing** — as each coin lands: the chip pulses (brief scale pop) and a
   `coin_land` ping plays (throttled to ≥60ms between pings so rapid landings don't
   mush).
5. **Counter tick** — the displayed balance rapid-ticks from `openingBalance` to the
   **committed live balance**, starting at the first landing and finishing with the
   last (~0.7–1.0s window, rAF-driven integer counting). The tick target is the live
   `state.coinBalance`, so lease/tax (and any mid-tick purchase) are absorbed into
   where the counter settles — no second animation.
6. **Done** — overlay unmounts, `onDone` fires, HUD returns to plain committed
   rendering.

**Skip:** any `pointerdown` or `keydown` during the celebration fast-forwards to the
resolved state instantly. (Skip listeners attach after the closing event's dispatch
completes — e.g. registered in an effect — so the click/Escape that closes the modal
can never skip the celebration it just started.) (coins removed, counter set to final, no further sounds
scheduled; already-sounding notes ≤260ms simply finish). Pressing Next Day during a
celebration cancels it the same way before the new turn processes. The overlay never
blocks input.

**Season-boundary turns (sound-only):** when the turn that opens the summary also
ends the season (`phase === 'season_passed' | 'season_4_won' | 'season_failed'`), the
`SeasonTransitionModal` overlays the board and owns the stage, so there is no hold,
no coin flight and no counter tick. The per-crop harvest chimes **still play**
(staggered as in step 2, but with no visuals), fired as the summary opens rather than
on close — the balance chip is behind the transition modal, so the flight would land
on a hidden target. Reduced-motion is irrelevant here (there was no motion to drop).

**Fallbacks:**

- Plot DOM node not found (edge: layout change mid-flight) → that group spawns from
  the lower center of the viewport.
- `prefers-reduced-motion` → no hold, no flight, no tick: balance renders committed
  value immediately (today's behavior). Sounds still play (motion preference is not
  an audio preference; audio has its own mute).
- Web Animations API unavailable (jsdom/tests, ancient browsers) → celebration
  resolves instantly (equivalent to skip at t=0).

## 4. Audio

### New — `src/audio/sfx.ts`

A tiny Web Audio synth module. **No binary assets, no licensing.** Public surface:

```ts
type SfxId = 'harvest_radish' | 'harvest_parsnip' | 'harvest_pumpkin' | 'coin_land';
playSfx(id: SfxId): void;   // no-ops when muted or Web Audio unavailable
isMuted(): boolean;
setMuted(muted: boolean): void;
```

- The `AudioContext` is created lazily on first `playSfx` call — which only ever
  happens inside a user-gesture call stack (modal close click / keypress), so
  autoplay policy never bites. `resume()` is called if the context is suspended.
- Sound recipes are an internal table keyed by `SfxId` — **swapping to CC0 audio
  files later means changing this module's internals only; call sites never change.**
  (Auditioned via a synth demo on 2026-07-19; recipes below are the picked variants.)

| SfxId | Recipe (oscillator notes: wave, freq, duration, peak gain) |
|---|---|
| `harvest_radish` | square 880→1175Hz slide, 90ms, 0.14 |
| `harvest_parsnip` | square 587Hz 80ms, then square 880Hz 120ms at +90ms, 0.14 |
| `harvest_pumpkin` | square 196→98Hz 220ms 0.20 **+** triangle 98→65Hz 260ms 0.30 (layered) |
| `coin_land` | square 1319Hz 40ms, then square 1760Hz 70ms at +45ms, 0.09 |

Each note: linear attack ~5ms, exponential decay to silence over its duration.

### Mute toggle & persistence

- 🔊/🔇 icon button in the HUD right cluster (next to "Last Turn"), `aria-pressed`,
  accessible name "Mute sound effects", ≥44px touch target on mobile.
- Persisted in its own localStorage key **`pixel-parsnips-audio`**
  (`{ schemaVersion: 1, muted: boolean }`), defensive parse per the `records.ts`
  pattern (malformed JSON → default unmuted, never throws), untouched by Restart.
- Default: **unmuted**.

## 5. Components

### New — `src/components/HarvestCelebration.tsx`

Portal overlay owning the whole sequence. Props: `{ log: DailyLogEntry, onDone: () => void }`.
Locates origins via `[data-plot-id]`, target via `[data-coin-target]`. Registers
window `pointerdown`/`keydown` skip listeners; full cleanup (animations, timers,
listeners) on unmount.

### New — `src/hooks/useAnimatedNumber.ts`

`useAnimatedNumber(target: number, opts: { animate: boolean; durationMs?: number }): number`
— rAF-driven displayed integer that ticks toward `target` when `animate` is true and
motion is allowed; otherwise renders `target` immediately. Retargets smoothly if
`target` changes mid-flight.

### Changed — `src/components/HUD.tsx`

- Balance chip gets `data-coin-target`.
- New props: `heldBalance?: number | null` (render this instead of `coinBalance`
  while the summary modal holds the reveal) and `tickToLive?: boolean` (drives
  `useAnimatedNumber` during the celebration).
- **Danger-level styling (critical/low border + text color) and the chip's
  `aria-label` always use the committed `coinBalance`** — juice never hides gameplay
  information from anyone, sighted or not.
- Hosts the mute toggle button.

### Changed — `src/components/PlotCard.tsx` (or the `FarmGrid` wrapper)

Plot root element gets `data-plot-id={id}`.

### Changed — `src/components/GameBoard.tsx`

Owns a three-state celebration flow: `idle` → `holding` (auto-open modal up, pending
celebration, HUD holds `openingBalance`) → `celebrating` (modal closed,
`HarvestCelebration` mounted) → `idle` on done/skip/cancel. The trigger-condition
check from §2 happens when entering `holding` (on modal auto-open) and is re-checked
on close.

## 6. Accessibility

- Celebration overlay is `aria-hidden="true"` — purely decorative.
- No `aria-live` on the ticking counter (a rapidly mutating live region would spam
  screen readers); the chip's `aria-label` carries the final committed value at all
  times.
- Mute button: `aria-pressed`, name "Mute sound effects".
- Reduced motion honored per §3; jsdom `matchMedia` stub already exists in
  `tests/setup.ts` (013).

## 7. Testing

Vitest + Testing Library + fake timers, following 013's patterns.

- **`sfx.ts`**: mute state persists and round-trips; malformed
  `pixel-parsnips-audio` JSON → defaults, no throw; `playSfx` no-ops without
  `AudioContext` (jsdom default) and when muted; each `SfxId` resolves to a recipe.
- **`useAnimatedNumber`**: ticks toward target over the duration; `animate: false`
  or reduced motion → immediate; retargets mid-flight.
- **`HarvestCelebration`**: spawns ≤20 coins; resolves instantly when
  `element.animate` is missing (jsdom guard); `onDone` fires after the sequence
  (with a WAAPI stub) and immediately on `pointerdown`/`keydown` skip.
- **`GameBoard` integration**: fresh-open harvest day → HUD shows `openingBalance`
  while modal is open, celebration overlay mounts on close, HUD shows committed
  balance after done. Last Turn reopen → no hold, no celebration. Quiet day → no
  hold, no celebration. `phase === 'season_passed'` turn → no coin flight, but the
  harvest chime still plays (sound-only). Next Day during celebration → cancelled
  cleanly.
- **`HUD`**: mute toggle renders, toggles `aria-pressed`, persists; danger styling
  and `aria-label` reflect committed balance even while a held/ticking value is
  displayed.
- Update any existing HUD/GameBoard tests that assert the balance renders the
  committed value while the summary modal is open.

## 8. Acceptance criteria

- On a fresh harvest-day summary close: coins fly from the harvested plots to the
  balance chip, the counter rapid-ticks from the pre-turn balance to the live
  balance, per-crop sounds play per group and a ping per landing. Total ≤2s.
- Any click/keypress instantly resolves the celebration; input is never blocked.
- No celebration on quiet days, Last Turn reopens, or bankruptcy. Season-boundary
  harvest turns play the harvest chime only (no coin flight — the transition modal
  owns the stage).
- Reduced-motion users see today's instant behavior (sounds still play; mute is
  independent).
- Mute toggle silences everything and survives reload + Restart.
- Danger styling and screen-reader balance always reflect the committed balance.
- `npm test && npm run lint` pass. No engine/schema changes, no new dependencies.
