# 028 — Farm Scene Coherence

**Status:** Draft · **Date:** 2026-08-27 · **Effort:** M
**Backlog items:** the 2026-08-26 art review (fields/HUD too dark; grid framing and decor mismatched)
**Depends on:** [027-hud-legibility](../027-hud-legibility/spec.md) — see §E.

---

## Problem

### 1. The palette does not control the colours that need changing

[`src/theme/palette.ts`](../../src/theme/palette.ts) opens with *"025 — every colour the game
paints, in one place."* Measured against the code, that is materially untrue:

| | Count |
|---|---|
| Hex literals hardcoded in components | 50 |
| Distinct values outside `PALETTE` | 35 (33 live — two are in dead code) |
| Values in `PALETTE` | 14 |

```
19  PlotCard.tsx     11  Shop.tsx      8  SeedCard.tsx
 7  FarmGrid.tsx      2  index.css     2  App.css (dead — never imported)
 1  DaySummaryModal.tsx
```

This is why "the fields are dark" and "the HUD is dark" are one problem with one blocker.
The fields are dark because `PlotCard` paints `bg-[#160F07]` and `FarmGrid` paints
`bg-[#2A1A0E]` — values `PALETTE` has never heard of. **Lifting the palette alone would
lighten the HUD and page backdrop and leave the fields exactly as dark as they are today.**
The contrast gate is blind to them for the same reason: it reads `PALETTE`.

### 2. The chrome cannot be lifted while its foregrounds are fixed

Measured maximum lift before an enforced pair drops below 4.5:1:

| Token | Current | Max with foregrounds fixed | Bound by |
|---|---|---|---|
| `bar` | `#1C1208` | `#1c1309` — 0.2% | lease readout @ 4.50 |
| `chip` | `#33220E` | `#392815` — 2.9% | critical balance @ 4.53 |
| `soil` | `#5E3D22` | `#65452c` — 4.4% | section label @ 4.54 |
| `ink` | `#241C14` | `#524b45` — 20.9% | stat-row label @ 4.54 |
| `page` | `#241806` | unconstrained | no enforced pairs |

2.9% toward white is invisible. But the ceiling is set by **one foreground**: freeing
`danger` raises `chip`'s available lift from 2.9% to **18.3%**. Six times the room, from
one colour.

### 3. The farm grid renders in a different art vocabulary

[`FarmGrid.tsx`](../../src/components/FarmGrid.tsx) predates 018 and never migrated:

- Four hand-rolled inline `<svg>` decorations — `<ellipse>` pebbles and `#4A7230` `<line>`
  grass tufts — sitting beside the real pixel-art PNGs on the page backdrop.
- A `border-4 border-farm-chipBorder` rounded rectangle whose code comment calls it a
  "fence border". It is a flat CSS border.
- `[filter:url(#pp-grain)]` applied to the **whole subtree**, so the SVG turbulence smudges
  the LPC crop sprites that `image-rendering: pixelated` exists to keep sharp.

018's own decision record says *"nothing is hand-drawn in CSS/SVG except the refined
awning"* — but the grid was outside 018's scope, so it kept its T017 art. The incoherence
is documented, not accidental.

## Goals

- Every colour the game paints lives in `PALETTE` and is reachable by the contrast gate.
- The play surface reads lighter — as tilled soil, not as a hole in the page.
- The HUD reads lighter.
- The farm grid renders in the same pixel-art vocabulary as the rest of the game.

## Non-goals

- **F6 building sprites** — deferred to 029. Needs new art and a new in-flow container;
  it cannot hang off `PageBackdrop`, which is `fixed`, `-z-10` and positioned in viewport
  percentages, so a barn would sit behind the grid on a short screen and in the open on a
  tall one.
- **F3 weather tint** — different surface, different mechanism. Stays in the backlog.
- **`soil` and `ink`.** Lifting `soil` past 4.4% requires raising the `parchment/70` caption
  alpha, which appears in 9 places across 10 components that use `bg-farm-soil`. That is a
  second feature, and this spec does not start it.
- No engine, schema, save-migration, analytics or simulator change.

---

## A. Colour consolidation

Fold the live hardcoded literals into `PALETTE` as named, role-bearing tokens. Three
classes of work:

**A1 — Straight substitutions.** Three components hardcode values that already have tokens:

| Value | Where | Replace with |
|---|---|---|
| `#5E3D22` | `Shop.tsx:173` | `PALETTE.soil` |
| `#C0392B` | `SeedCard.tsx:19` | `PALETTE.red` |
| `#F5C842` | `SeedCard.tsx:187` | `PALETTE.gold` |

**A2 — New tokens.** Everything else, named for its role rather than its hue. The field
tokens are the ones §B lifts:

| Role | Current value | Source |
|---|---|---|
| Grid fill | `#2A1A0E` | `FarmGrid.tsx:36` |
| Plot: empty / locked | `#160F07` | `PlotCard.tsx:89,99` |
| Plot: growing | `#1A2C10` | `PlotCard.tsx:260` |
| Plot: ready | `#162810` | `PlotCard.tsx:259` |
| Plot: pest-damaged | `#2A1010` | `PlotCard.tsx:117` |
| Plot border | `#3D2510` | `PlotCard.tsx:99,345` |
| Locked label | `#B8A894` | `PlotCard.tsx:102` |
| Tilled-row gradients | `#3a2010` `#2a1208` `#1a0a02` `#2A1A0E` `#221408` | `PlotCard.tsx:157–158,351` |
| Page fallback | `#140e06` | `index.css:8` |
| Disaster modal ground | `#2A0A0A` | `DaySummaryModal.tsx:45` |
| Shop chrome | `#2A1808` `#3D2410` `#4A2F1A` `#5A3A1E` `#6B4A2A` `#7A4E24` | `Shop.tsx` |
| Shop awning stripes | `#3F7D30` `#A8452A` `#E8D9A8` | `Shop.tsx:33` |
| Seed-card per-crop | `#6E2A24` `#3A5220` `#4E8A2E` `#7C3E14` `#C87820` `#BFE6A8` | `SeedCard.tsx:19–21,141` |
| Danger hover | `#d94040` | `PlotCard.tsx:130` |

**A2b — Deleted, not tokenised.** `#4A7230` (`FarmGrid.tsx:78–93`) is the grass-tuft stroke
in the inline SVGs that §C removes outright. It gets no token — the markup that used it
ceases to exist.

**A3 — Delete dead code.** `src/App.css` is never imported: `main.tsx` imports only
`index.css`, and `index.css:40` carries the comment *"App.css, which is never imported"*.
Delete the file rather than tokenise its Vite-template colours (`#646cff`, `#61dafb`,
`#888`).

Consolidation must be **visually neutral** — same rendered colours, different source. Any
visible change belongs to §B, so the two can be reviewed separately.

## B. The lift

**B1 — Fields.** Unconstrained: these surfaces have no enforced contrast pairs today
precisely because they were invisible to the gate. Direction, validated in a live browser
prototype:

| Token | From | To (direction) |
|---|---|---|
| Grid fill | `#2A1A0E` | `#4A3218` |
| Plot: empty / locked | `#160F07` | `#3A2712` |
| Plot: growing | `#1A2C10` | `#2E4A1C` |
| Plot: ready | `#162810` | `#33551F` |
| Plot border | `#3D2510` | `#6B4A2A` |

**Implement these values.** A visual-review pass may adjust them — colour is a taste call
and the prototype was a single viewport at one time of day — but any adjustment must re-run
the expanded contrast gate from §D and satisfy the separation principle in §B3. Do not treat
the review pass as optional licence to leave values unchosen.

**B2 — Chrome.** Two background moves, plus the one foreground change that permits them:

| Token | From | To | Measured at the new value |
|---|---|---|---|
| `bar` | `#1C1208` | `#2A1B0A` | Unconstrained **once 027 lands** — see §E |
| `chip` | `#33220E` | `#4A3218` | gold 7.51 · parchment/70 5.86 · parchment 10.15 — all clear AA |
| `danger` | `#EB6A5C` | `#F59A90` | 3.83 at the new chip → **fails**; re-picked gives 5.63 |

`danger` is the unlock. It is the critical-balance red, and 025 chose `#EB6A5C` deliberately
to clear AA against the *old* dark chip; on a lighter chip it must move or the chip cannot.
**Approved 2026-08-27.**

**B3 — Separation principle.** Chrome and play surface must stay on distinguishable tones.
The prototype put `chip` and the grid fill both at `#4A3218` and the hierarchy flattened —
the HUD chips read as part of the field. Whichever final values are chosen, this is a
review criterion, not an afterthought.

## C. Farm-scene art migration

- **Decorations.** Replace the four inline `<svg>` blocks in `FarmGrid.tsx` (two pebble
  clusters, two grass tufts) with the decor PNGs already in the repo — `stones.png`,
  `grass_1.png`, `grass_2.png` — resolved through the existing `getDecorUrl` helper.
  **No new art is required.**
- **Frame.** Replace `border-4 border-farm-chipBorder` with a two-layer treatment: the
  border takes the new plot-border token and gains an inset shadow so the grid reads as a
  recessed bed rather than a flat outline, and the misleading "fence border" comment is
  rewritten to describe what the code actually does. A real fence *asset* is out of scope
  here — if one is made later it supersedes this treatment under 018's every-asset-optional
  rule, so nothing in §C blocks on new art.
- **Grain.** Scope `[filter:url(#pp-grain)]` to the grid's background layer instead of the
  whole subtree, so crop sprites and plot chrome render crisp. The texture is kept; the
  smudging is not.

## D. Contrast gate expansion

Add `PAIRS` rows for every newly-tokenised surface that carries text, each naming the
component it mirrors, per the file's existing convention:

- Plot `Plant` label, `Locked` label, and `Buy plot · N` on their plot backgrounds
- Shop chrome text on the shop panel tokens
- Seed-card text on the per-crop card backgrounds

Each row must pass at §B's *lifted* values, not at today's. Gating them is the whole point:
it is what stops this lift — or the next one — from silently pushing a field label below AA.

Also update the "Known sub-AA surfaces" comment — the three documented exceptions reference
`farm-chip`, whose value changes in §B2, so their approximate ratios move.

## E. Sequencing

**028 depends on 027 landing first.** `bar` is capped at a 0.2% lift by the `lease readout`
pair (`stone` on `bar`, currently 4.529). 027 retires that pair — it is the only
`farm-stone`-on-`farm-bar` surface in the codebase — after which `bar` has no enforced pairs
and can be lifted freely. Without 027, §B2's `bar` row is impossible and the HUD half of
this spec does not happen.

## Verification

- `npm test && npm run lint` green.
- `tests/palette.contrast.test.ts` green with the expanded `PAIRS`.
- **§A is visually neutral.** Screenshot the game before and after consolidation at the same
  viewport and confirm no rendered colour changed. If something moved, it belongs in §B.
- `grep -rn "#[0-9A-Fa-f]\{6\}" src/components/` returns nothing.
- Crop sprites render crisp inside the grid — compare a `ready` frame before and after the
  grain change at 2× zoom.
- Real-device check on a physical phone, as in 027.

## Backlog updates on ship

- Record 028 in the shipped-specs list.
- **F3** stays open, explicitly deferred by this spec.
- **F6** → note that 029 will carry it, and why it could not hang off `PageBackdrop`.
- Note that 025's "every colour in one place" claim is true only as of 028.
