# 028 — Farm Scene Coherence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring every colour the game paints under `PALETTE` and the contrast gate, lift the play surface and HUD out of near-black, and render the farm grid in the same pixel-art vocabulary as the rest of the game.

**Architecture:** Three ordered phases. **Consolidate** (Tasks 1–3) moves 46 hardcoded literals into tokens with *zero* rendered-colour change. **Gate** (Task 4) fixes two pre-existing AA failures and extends `palette.contrast.test.ts` to cover the newly-visible surfaces — so the gate becomes the test that protects the lift. **Lift** (Tasks 5–7) changes the values and migrates the grid's art. Presentation only: no engine, schema, analytics or simulator change.

**Tech Stack:** TypeScript ~5.6, React 18.3, Tailwind CSS 3.4, Vite 5.4, Vitest + Testing Library.

**Branch:** `028-farm-scene-coherence` (already checked out; the spec commits live here).

**Spec:** [spec.md](spec.md).

---

## Critical constraints (read before starting)

1. **Tasks 1–3 must not change a single rendered colour.** Consolidation is a pure
   refactor. If a screenshot differs, something is wrong — do not "fix it up" in the same
   commit. Every visible change belongs to Tasks 5–7, so the two can be reviewed apart.

2. **Do not alias these to existing tokens**, even though they match or nearly match:
   - `#C0392B` (`SeedCard.tsx:19`) is the **radish** border. It equals `PALETTE.red` by
     coincidence of taste. Aliasing couples a crop's identity to the danger red.
   - `#4A2F1A` (`Shop.tsx:175`) carries a comment stating it is *deliberately* not
     `PALETTE.soil`. Give it its own token; never derive it from `soil`.

3. **Two values live inside comments, not code** — `Shop.tsx:173` and `index.css:34`. There
   is nothing there to substitute. Leave the prose alone unless Task 6 changes the value it
   describes.

4. **`bar` cannot be lifted until 027 lands** (it retires the `stone`-on-`bar` pair). If 027
   is not in this branch's history, do Task 6 without the `bar` row and say so in the commit.

---

## File structure

| File | Change | Responsibility after this plan |
|---|---|---|
| `src/theme/palette.ts` | Modify | Genuinely every colour the game paints |
| `tailwind.config.ts` | Modify | Maps palette → `farm-*` classes; owns the `html` base background |
| `src/App.css` | **Delete** | — (never imported) |
| `src/index.css` | Modify | Loses the `html` background rule to the Tailwind base layer |
| `src/components/FarmGrid.tsx` | Modify | Grid bed + PNG decor; no inline SVG, no subtree grain |
| `src/components/PlotCard.tsx` | Modify | Plot tiles, all colours tokenised |
| `src/components/Shop.tsx` | Modify | Shop chrome, all colours tokenised |
| `src/components/SeedCard.tsx` | Modify | Crop themes, all colours tokenised |
| `src/components/DaySummaryModal.tsx` | Modify | Disaster ground tokenised |
| `tests/palette.contrast.test.ts` | Modify | Gate extended to the play surface |
| `tests/components/FarmGrid.test.tsx` | Modify | Asserts the art migration |
| `backlog.md` | Modify | Bookkeeping (Task 8) |

---

## Task 1: Delete the dead App.css

**Files:**
- Delete: `src/App.css`

`src/main.tsx` imports only `./index.css`. `src/index.css:40` already carries the comment
*"Lives here (not App.css, which is never imported)"*. The file is Vite scaffolding.

- [ ] **Step 1: Prove nothing imports it**

Run: `grep -rn "App.css" src/ tests/ index.html`
Expected: no output at all. If anything matches, stop — the file is live and this task is
wrong.

- [ ] **Step 2: Delete it**

```bash
git rm src/App.css
```

- [ ] **Step 3: Verify the build and suite are unaffected**

Run: `npm run build && npm test`
Expected: PASS. The build proves no bundler entry point referenced it.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: delete the never-imported App.css

Vite scaffolding. main.tsx imports only index.css, which already carried a
comment noting App.css is dead."
```

---

## Task 2: Tokenise the play surface (visually neutral)

**Files:**
- Modify: `src/theme/palette.ts`
- Modify: `tailwind.config.ts`
- Modify: `src/components/FarmGrid.tsx:36`
- Modify: `src/components/PlotCard.tsx` (19 literals)

- [ ] **Step 1: Add the play-surface tokens**

Append to `PALETTE` in `src/theme/palette.ts`, before the closing `} as const;`:

```ts
  // ── Play surface (028) ────────────────────────────────────────────────────
  // These were hardcoded in FarmGrid/PlotCard until 028 and were therefore
  // invisible to tests/palette.contrast.test.ts. Values here are pre-lift; the
  // lift is Task 5 of specs/028-farm-scene-coherence/plan.md.

  /** Farm-grid bed behind the plot tiles. */
  field: '#2A1A0E',
  /** Empty, locked, or purchasable plot tile. */
  plot: '#160F07',
  /** Plot with a crop still growing. */
  plotGrowing: '#1A2C10',
  /** Plot whose crop is ready to harvest. */
  plotReady: '#162810',
  /** Plot destroyed by a Pest Infestation. */
  plotPest: '#2A1010',
  /** Plot tile border. */
  plotBorder: '#3D2510',
  /** "Locked" label on an unpurchased tile. */
  plotLockedLabel: '#B8A894',
  /** Hover state for the red "Clear Plot" button. */
  redHover: '#d94040',
  /** Day Summary ground on a disaster turn. */
  disasterGround: '#2A0A0A',
  /** Flat colour painted beneath the PageBackdrop layer. */
  pageFallback: '#140e06',

  // Gradient stops — inline `style` only, never Tailwind classes.
  /** Tilled-row stripes on an empty plot tile. */
  tilledLight: '#2A1A0E',
  tilledDark: '#221408',
  /** Exhausted-plot hatching, light → dark. */
  exhaustedMid: '#3a2010',
  exhaustedDark: '#2a1208',
  exhaustedShadow: '#1a0a02',
```

- [ ] **Step 2: Expose the class-bearing tokens to Tailwind**

Only tokens used as `bg-farm-*` / `text-farm-*` / `border-farm-*` classes need mapping.
Gradient stops are consumed through `PALETTE` in inline styles and must NOT be added.

In `tailwind.config.ts`, inside `colors.farm`, after `danger: PALETTE.danger,`:

```ts
          field: PALETTE.field,
          plot: PALETTE.plot,
          plotGrowing: PALETTE.plotGrowing,
          plotReady: PALETTE.plotReady,
          plotPest: PALETTE.plotPest,
          plotBorder: PALETTE.plotBorder,
          plotLockedLabel: PALETTE.plotLockedLabel,
          redHover: PALETTE.redHover,
          disasterGround: PALETTE.disasterGround,
```

- [ ] **Step 3: Replace FarmGrid's fill**

`src/components/FarmGrid.tsx:36` — change only the background class:

```tsx
    <div className="relative rounded-xl overflow-hidden p-3 bg-farm-field [filter:url(#pp-grain)] shadow-inner">
```

- [ ] **Step 4: Replace PlotCard's class-based literals**

Six edits in `src/components/PlotCard.tsx`, each a class-name substitution only:

| Line | From | To |
|---|---|---|
| 89 | `bg-[#160F07]` | `bg-farm-plot` |
| 99 | `border-[#3D2510]/80 bg-[#160F07]` | `border-farm-plotBorder/80 bg-farm-plot` |
| 102 | `text-[#B8A894]` | `text-farm-plotLockedLabel` |
| 117 | `bg-[#2A1010]` | `bg-farm-plotPest` |
| 130 | `hover:bg-[#d94040]` | `hover:bg-farm-redHover` |
| 259 | `bg-[#162810]` | `bg-farm-plotReady` |
| 260 | `bg-[#1A2C10]` | `bg-farm-plotGrowing` |
| 345 | `border-[#3D2510]/80` | `border-farm-plotBorder/80` |

- [ ] **Step 5: Replace PlotCard's inline-style gradients**

Add the import at the top of `src/components/PlotCard.tsx`:

```tsx
import { PALETTE } from '../theme/palette';
```

Replace the exhausted-plot background (around line 156):

```tsx
        background: [
          `repeating-linear-gradient(20deg, ${PALETTE.exhaustedMid} 0px, ${PALETTE.exhaustedMid} 8px, ${PALETTE.exhaustedDark} 9px, ${PALETTE.exhaustedDark} 10px)`,
          `repeating-linear-gradient(-30deg, transparent 0px, transparent 12px, ${PALETTE.exhaustedShadow} 13px, ${PALETTE.exhaustedShadow} 14px)`,
        ].join(', '),
```

Replace the empty-plot tilled rows (around line 351):

```tsx
        background: `repeating-linear-gradient(180deg, ${PALETTE.tilledLight} 0px, ${PALETTE.tilledLight} 5px, ${PALETTE.tilledDark} 5px, ${PALETTE.tilledDark} 7px)`,
```

- [ ] **Step 6: Verify no literals remain in these two files**

Run: `grep -n "#[0-9A-Fa-f]\{6\}" src/components/PlotCard.tsx src/components/FarmGrid.tsx`
Expected: six matches, all on the `stroke="#4A7230"` inline-SVG lines, which Task 7 deletes
outright. Nothing else.

- [ ] **Step 7: Verify the refactor is visually neutral**

Start the preview with the `preview_start` tool (`{name: "dev"}`), screenshot at the default
viewport, and compare against a screenshot taken before Task 2. The plots, grid and labels
must be pixel-identical. Any difference means a token got the wrong value — fix the value,
do not accept the new look.

- [ ] **Step 8: Run the suite and linter**

Run: `npm test && npm run lint`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/theme/palette.ts tailwind.config.ts src/components/FarmGrid.tsx src/components/PlotCard.tsx
git commit -m "refactor(theme): tokenise the play surface

Pure refactor — identical rendered colours. These values were hardcoded in
FarmGrid and PlotCard, which is why the contrast gate could never see the
surface the player spends the whole game looking at."
```

---

## Task 3: Tokenise the shop, seed cards, modal and base CSS (visually neutral)

**Files:**
- Modify: `src/theme/palette.ts`
- Modify: `tailwind.config.ts`
- Modify: `src/components/Shop.tsx` (10 literals)
- Modify: `src/components/SeedCard.tsx` (8 literals)
- Modify: `src/components/DaySummaryModal.tsx:45`
- Modify: `src/index.css`

- [ ] **Step 1: Add the remaining tokens**

Append to `PALETTE`, after the Task 2 block:

```ts
  // ── Shop chrome (028) — inline `style` only ───────────────────────────────
  /** Carved sign board behind the "Shop" heading. */
  shopSign: '#5A3A1E',
  /** Sign board border, and the dark end of the ledge gradient. */
  shopSignBorder: '#3D2410',
  /** Light end of the ledge gradient. */
  shopLedge: '#7A4E24',
  /** Decorative corner studs. */
  shopStud: '#2A1808',
  /** Market-stall awning cloth, in stripe order. */
  awningGreen: '#3F7D30',
  awningCream: '#E8D9A8',
  awningRust:  '#A8452A',
  awningBrown: '#6B4A2A',
  /**
   * Awning fallback stripe. Deliberately NOT derived from `soil` — see the
   * comment at its use site in Shop.tsx. It is a token so it is *named*, not so
   * it is coupled: changing `soil` must never change this.
   */
  awningFallback: '#4A2F1A',

  // ── Crop identity (028) — inline `style` only ─────────────────────────────
  // Kept independent of `red`/`grass`/`gold`: these are a crop's identity, and
  // aliasing them would make a semantic-colour change recolour the seed cards.
  cropRadishBg:     '#6E2A24',
  cropRadishBorder: '#C0392B',
  cropParsnipBg:     '#3A5220',
  cropParsnipBorder: '#4E8A2E',
  cropPumpkinBg:     '#7C3E14',
  cropPumpkinBorder: '#C87820',
```

And one Tailwind-mapped token:

```ts
  /** Estimated-profit mint green, on the tinted seed cards. */
  profitMint: '#BFE6A8',
```

In `tailwind.config.ts`, add to `colors.farm`:

```ts
          profitMint: PALETTE.profitMint,
```

- [ ] **Step 2: Replace Shop's literals**

Add `import { PALETTE } from '../theme/palette';` to `src/components/Shop.tsx` if absent,
then substitute — all are inside inline `style` objects:

| Line | From | To |
|---|---|---|
| 33 | `#3F7D30`, `#E8D9A8`, `#A8452A`, `#6B4A2A` in the awning gradient | `${PALETTE.awningGreen}` etc. (make the string a template literal) |
| 52 | `'linear-gradient(#7A4E24, #3D2410)'` | `` `linear-gradient(${PALETTE.shopLedge}, ${PALETTE.shopSignBorder})` `` |
| 65 | `backgroundColor: '#5A3A1E'` | `backgroundColor: PALETTE.shopSign` |
| 79 | `borderColor: '#3D2410'` | `borderColor: PALETTE.shopSignBorder` |
| 97 | `background: '#2A1808'` | `background: PALETTE.shopStud` |
| 175 | `'#4A2F1A',` | `PALETTE.awningFallback,` |

Leave the explanatory comment above line 175 in place. It documents *why* this value is not
`soil`, and that reasoning is still true — the token exists to name the colour, not to
couple it.

- [ ] **Step 3: Replace SeedCard's literals**

Add the `PALETTE` import, then replace `CROP_THEME` (line 18):

```tsx
const CROP_THEME: Record<CropId, { cardBg: string; border: string }> = {
  radish:  { cardBg: PALETTE.cropRadishBg,  border: PALETTE.cropRadishBorder },
  parsnip: { cardBg: PALETTE.cropParsnipBg, border: PALETTE.cropParsnipBorder },
  pumpkin: { cardBg: PALETTE.cropPumpkinBg, border: PALETTE.cropPumpkinBorder },
};
```

Line 141 — class substitution:

```tsx
      <p className="text-xs text-farm-profitMint font-pixel">
```

Line 187 — this one *is* a genuine token match (gold is the selection colour):

```tsx
        borderColor: isSelected ? PALETTE.gold : theme.border,
```

- [ ] **Step 4: Replace the disaster ground**

`src/components/DaySummaryModal.tsx:45`:

```tsx
          showDisasterChrome ? 'bg-farm-disasterGround' : 'bg-farm-soil',
```

- [ ] **Step 5: Move the html background into the Tailwind base layer**

Delete this rule from `src/index.css`:

```css
html {
  background-color: #140e06;
}
```

Then, in `tailwind.config.ts`, add the import and the plugin so the value derives from
`PALETTE` rather than being duplicated in a CSS file the palette cannot reach:

```ts
import plugin from 'tailwindcss/plugin';
```

```ts
  plugins: [
    plugin(({ addBase }) => {
      // 028 — the flat colour painted beneath PageBackdrop's fixed layer. It
      // lives here, not in index.css, so it derives from PALETTE like every
      // other colour rather than being a literal the contrast gate cannot see.
      addBase({ html: { backgroundColor: PALETTE.pageFallback } });
    }),
  ],
```

If `plugins:` already exists, add to the array rather than replacing it.

Update the comment at `index.css:34` that names `#140e06` so it points at the new home
instead of a rule that no longer exists.

- [ ] **Step 6: Verify no literals remain anywhere**

Run: `grep -rn "#[0-9A-Fa-f]\{3,8\}" src/components/ src/index.css | grep -v "^\s*\*" | grep -v "//"`
Expected: only the six `stroke="#4A7230"` lines in `FarmGrid.tsx` (deleted in Task 7) and
any hex named inside a comment. No live values.

- [ ] **Step 7: Verify visual neutrality, then run the suite**

Screenshot and compare as in Task 2 Step 7 — including the Shop panel and the seed cards,
which this task touches. Then run: `npm test && npm run lint`
Expected: PASS, and no visible difference.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(theme): tokenise shop, seed cards, modal and base CSS

Pure refactor — identical rendered colours. The html background moves into a
Tailwind base plugin so it derives from PALETTE instead of being a literal in
a CSS file the palette cannot reach.

The awning fallback stripe and the per-crop identity colours get their own
tokens rather than aliases: Shop.tsx documents that its stripe is deliberately
decoupled from `soil`, and aliasing the radish border to `red` would make a
semantic-colour change recolour a seed card."
```

---

## Task 4: Fix two sub-AA labels and extend the contrast gate

**Files:**
- Modify: `src/components/PlotCard.tsx` (two label classes)
- Modify: `tests/palette.contrast.test.ts`

Consolidation made the play surface visible to the gate, and it exposes two pre-existing
WCAG AA failures. Both are fixed on the foreground side; no background changes.

| Surface | Today | Ratio | Fix | New ratio |
|---|---|---|---|---|
| "Pest Damage" label | `text-farm-red/90` on `plotPest` | 2.89 ✗ | `text-farm-danger` | **5.72** |
| "Nd remaining" label | `text-farm-stone/80` on `exhaustedMid` | 2.89 ✗ | `text-farm-parchment/80` | **8.69** |

`farm-stone` cannot work on that brown at any alpha — 3.70 even at full opacity — so the
second fix must change the hue, not the alpha.

- [ ] **Step 1: Write the failing gate rows**

Add to `PAIRS` in `tests/palette.contrast.test.ts`:

```ts
  { name: 'plot buy-price',     where: 'PlotCard.tsx purchasable tile', fg: PALETTE.gold,            bg: PALETTE.plot },
  { name: 'plot locked label',  where: 'PlotCard.tsx locked tile',      fg: PALETTE.plotLockedLabel, bg: PALETTE.plot },
  { name: 'plant label',        where: 'PlotCard.tsx empty tile',       fg: PALETTE.gold,            bg: PALETTE.tilledLight },
  { name: 'growing tile text',  where: 'PlotCard.tsx growing tile',     fg: PALETTE.parchment,       bg: PALETTE.plotGrowing },
  { name: 'ready tile text',    where: 'PlotCard.tsx ready tile',       fg: PALETTE.gold,            bg: PALETTE.plotReady },
  { name: 'pest label',         where: 'PlotCard.tsx pest tile',        fg: PALETTE.danger,          bg: PALETTE.plotPest },
  { name: 'exhausted label',    where: 'PlotCard.tsx exhausted tile',   fg: PALETTE.parchment,       bg: PALETTE.exhaustedMid, alpha: 0.8 },
```

- [ ] **Step 2: Run the gate to see it pass — then prove it would have caught the bugs**

Run: `npx vitest run tests/palette.contrast.test.ts`
Expected: PASS. The rows above describe the *fixed* foregrounds, so they pass immediately.

To confirm the rows are meaningful rather than vacuous, temporarily change the `pest label`
row's `fg` to `PALETTE.red` with `alpha: 0.9` and re-run. Expected: FAIL at 2.89. Revert the
temporary change before continuing.

- [ ] **Step 3: Apply the two component fixes**

`src/components/PlotCard.tsx`, in `PestDamagedPlot`:

```tsx
      <span className="text-body font-pixel text-farm-danger mt-1">Pest Damage</span>
```

and in the exhausted tile:

```tsx
      <span className="text-caption font-pixel text-farm-parchment/80 mt-1 leading-snug">
        {daysUntilRecovery}d remaining
      </span>
```

- [ ] **Step 4: Note the newly-fixed surfaces in the exceptions comment**

The "Known sub-AA surfaces" doc comment lists exceptions the gate does not enforce. Add:

```
 * 028 — two play-surface labels that used to belong on this list are now fixed and
 * enforced in PAIRS instead: the "Pest Damage" label (was farm-red/90 on the pest
 * tile, 2.89:1) and the exhausted tile's "Nd remaining" (was farm-stone/80, 2.89:1).
 * Both were invisible to this gate until 028 tokenised the play surface.
```

- [ ] **Step 5: Run the suite and linter**

Run: `npm test && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/PlotCard.tsx tests/palette.contrast.test.ts
git commit -m "fix(a11y): raise two play-surface labels to WCAG AA

Tokenising the play surface made it visible to the contrast gate for the
first time, which exposed two labels at 2.89:1 — the pest tile's 'Pest
Damage' and the exhausted tile's 'Nd remaining'. Both are fixed on the
foreground side; farm-stone cannot clear AA on that brown at any alpha.

The gate now covers seven play-surface pairs, so the lift that follows
cannot silently push one below AA."
```

---

## Task 5: Lift the fields

**Files:**
- Modify: `src/theme/palette.ts` (play-surface values only)

Unconstrained by the gate before Task 4; protected by it now. Measured: every pair survives,
the tightest being ready-tile gold at 5.38.

- [ ] **Step 1: Change the values**

In the play-surface block of `PALETTE`:

```ts
  field: '#4A3218',
  plot: '#3A2712',
  plotGrowing: '#2E4A1C',
  plotReady: '#33551F',
  plotBorder: '#6B4A2A',
  tilledLight: '#4A3218',
  tilledDark: '#3A2712',
```

**The tilled stops are not optional.** A *plantable* empty tile is painted by the
`tilledLight`/`tilledDark` gradient, while *locked* and *purchasable* tiles use the flat
`plot` colour. Lifting `plot` alone would lighten the locked tiles and leave the plantable
ones dark — the board would read as inconsistent, with the tiles the player can actually use
being the darkest thing on screen.

Leave `plotPest`, `plotLockedLabel`, `redHover`, `disasterGround`, `pageFallback` and the
three `exhausted*` stops unchanged — the pest and exhausted tiles are deliberate "something
is wrong here" states and should stay darker than healthy soil.

- [ ] **Step 2: Run the contrast gate**

Run: `npx vitest run tests/palette.contrast.test.ts`
Expected: PASS. Expected ratios at the new values — buy-price 8.94, locked label 6.13, plant
label 7.51, growing text 8.46, ready text 5.38, pest 5.72, exhausted 8.69.

If any row fails, the value is wrong, not the test. Darken it until it passes.

- [ ] **Step 3: Check the separation principle (spec §B3)**

`field` is now `#4A3218`. Task 6 sets `chip` to the same value. Screenshot the game and
confirm the HUD chips still read as chrome rather than as part of the field. If they merge,
move one of the two — this is a stated review criterion, not a nitpick.

- [ ] **Step 4: Run the suite and screenshot**

Run: `npm test && npm run lint`, then screenshot at the default viewport and at 375px.
Expected: PASS, and the plots read as tilled soil rather than holes.

- [ ] **Step 5: Commit**

```bash
git add src/theme/palette.ts
git commit -m "feat(theme): lift the play surface out of near-black

The grid bed and plot tiles were painted #2A1A0E and #160F07, so the field
read as a hole in the page rather than as soil. All seven gated play-surface
pairs clear AA at the new values; the tightest is ready-tile gold at 5.38."
```

---

## Task 6: Lift the chrome

**Files:**
- Modify: `src/theme/palette.ts` (`bar`, `chip`, `danger`)

- [ ] **Step 1: Confirm 027 has landed**

Run: `grep -n "lease readout" tests/palette.contrast.test.ts`
Expected: **no output**. If the row is still there, 027 has not merged into this branch:
skip the `bar` change below, do the `chip` and `danger` changes only, and say so in the
commit message. `bar` is capped at a 0.2% lift while that pair exists.

- [ ] **Step 2: Change the values**

```ts
  bar: '#2A1B0A',
  chip: '#4A3218',
  danger: '#F59A90',
```

- [ ] **Step 3: Run the contrast gate**

Run: `npx vitest run tests/palette.contrast.test.ts`
Expected: PASS. At `chip: #4A3218` — gold 7.51, parchment/70 5.86, parchment 10.15, and the
re-picked `danger` 5.63. The old `#EB6A5C` would have measured 3.83 here and failed, which
is precisely why it moves.

- [ ] **Step 4: Check the critical-balance state by eye**

`danger` is the low-balance warning colour. Drive the balance below one day's lease in the
preview (or render `<HUD coinBalance={5} currentDay={1} …>`) and confirm the balance still
reads as alarming at the lighter red. If it does not, `danger` needs a different hue rather
than a lighter tint — it must stay legible *and* stay a warning.

- [ ] **Step 5: Re-check separation (spec §B3)**

`chip` and `field` are both `#4A3218` after Tasks 5 and 6. Screenshot and judge. If the HUD
chips read as part of the farm, adjust one — the prototype that produced these values showed
exactly this flattening.

- [ ] **Step 6: Refresh the documented sub-AA exceptions**

The "Known sub-AA surfaces" comment in `tests/palette.contrast.test.ts` lists three
exceptions whose ratios are quoted against `farm-chip` — a value this task just changed, so
every quoted number is now stale. Recompute all three and update the comment:

```
 *  - `farm-red` late-season warning ("— N days left", HUD.tsx balance caption) on `farm-chip`
 *  - idle/de-emphasized `farm-stone/60` button chrome (GameMenu gear, HUD undo) on `farm-chip`
 *  - Shop "New buildings unlock in Season N" `farm-stone` on `farm-chip/60`
```

Get the real numbers rather than estimating — add a temporary `console.log` of
`contrastRatio(PALETTE.red, PALETTE.chip)`, `contrastRatio(PALETTE.stone, PALETTE.chip, 0.6)`
and `contrastRatio(PALETTE.stone, PALETTE.chip, 0.6)` in a scratch test, read them, then
delete the scratch file. A lighter `chip` moves these *further* from AA, not closer, so if
any has become egregious, say so in the commit rather than quietly re-quoting it.

- [ ] **Step 7: Run the suite and linter**

Run: `npm test && npm run lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/theme/palette.ts tests/palette.contrast.test.ts
git commit -m "feat(theme): lift the HUD chrome

chip and bar move out of near-black. This is possible only because danger
moves with them: at the lighter chip the old #EB6A5C measured 3.83 and
failed AA, and it alone was capping the available chip lift at 2.9% instead
of 18.3%."
```

---

## Task 7: Farm-scene art migration

**Files:**
- Modify: `src/components/FarmGrid.tsx`
- Test: `tests/components/FarmGrid.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `tests/components/FarmGrid.test.tsx`:

```tsx
// 028 — the grid's decor was four hand-rolled inline <svg> blocks (ellipse pebbles,
// line grass) sitting beside the real pixel-art PNGs on the page backdrop. It now
// draws from the same asset registry as everything else.
describe('FarmGrid — 028 art coherence', () => {
  it('renders no inline SVG decorations', () => {
    const { container } = render(<FarmGrid plots={mkPlots(4)} unlockedPlots={4} />);
    expect(container.querySelectorAll('svg')).toHaveLength(0);
  });

  it('draws its decor from the shared asset registry', () => {
    const { container } = render(<FarmGrid plots={mkPlots(4)} unlockedPlots={4} />);
    const decor = [...container.querySelectorAll('img')].map(i => i.getAttribute('src') ?? '');
    expect(decor.some(s => s.includes('stones'))).toBe(true);
    expect(decor.some(s => s.includes('grass'))).toBe(true);
  });

  it('marks every decor image decorative', () => {
    const { container } = render(<FarmGrid plots={mkPlots(4)} unlockedPlots={4} />);
    for (const img of container.querySelectorAll('img')) {
      expect(img.getAttribute('alt')).toBe('');
      expect(img.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('does not apply the grain filter to the plot subtree', () => {
    const { container } = render(<FarmGrid plots={mkPlots(4)} unlockedPlots={4} />);
    const section = container.querySelector('section[aria-label="Farm plots"]');
    let node: HTMLElement | null = section as HTMLElement;
    while (node && node !== container) {
      expect(node.className).not.toMatch(/pp-grain/);
      node = node.parentElement;
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/components/FarmGrid.test.tsx -t "028 art coherence"`
Expected: FAIL — four `<svg>` elements found, no `<img>` elements, and `pp-grain` present on
an ancestor of the plots section.

- [ ] **Step 3: Replace the four inline SVGs with PNG decor**

In `src/components/FarmGrid.tsx`, delete all four `<svg>` blocks (the two pebble clusters and
the two grass tufts) and the now-unused `PALETTE` import if it is only used by them. Add
`import { getDecorUrl } from './decorAssets';` and this component above `FarmGrid`:

```tsx
/**
 * 028 — grid-edge decor, drawn from the same 018 asset registry as the page
 * backdrop. Replaces four hand-rolled inline <svg> blocks whose ellipses and
 * line-strokes read as a different art style from the pixel-art PNGs a few
 * pixels away. Every asset is optional: a missing file renders nothing, exactly
 * as PageBackdrop behaves.
 */
function GridDecor({ name, className, height }: { name: string; className: string; height: number }) {
  const url = getDecorUrl(name);
  if (url === null) return null;
  return (
    <img
      src={url}
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{ height, imageRendering: 'pixelated' }}
      className={`absolute pointer-events-none select-none ${className}`}
    />
  );
}
```

Then render four instances where the SVGs were, keeping the same corners:

```tsx
      <GridDecor name="stones"  className="top-1 left-2"      height={20} />
      <GridDecor name="stones"  className="bottom-1 right-2"  height={20} />
      <GridDecor name="grass_1" className="top-1/3 left-0.5"  height={22} />
      <GridDecor name="grass_2" className="top-0.5 right-1/4" height={12} />
```

- [ ] **Step 4: Move the grain off the plot subtree and fix the frame**

Replace the outer wrapper (line 36) and the border div beneath it:

```tsx
    // 028 — the grain sits on its own absolutely-positioned layer, not on the
    // wrapper. On the wrapper it filtered the whole subtree, and an SVG
    // turbulence filter over pixel art fights the `image-rendering: pixelated`
    // that keeps the LPC crop sprites crisp.
    <div className="relative rounded-xl overflow-hidden p-3 bg-farm-field shadow-inner">
      <div aria-hidden="true" className="absolute inset-0 [filter:url(#pp-grain)] bg-farm-field pointer-events-none" />

      {/* 028 — the bed's edge. A border plus an inset shadow so the grid reads
          as a recessed plot of earth; the pre-028 code called this a "fence
          border" and drew a flat rounded rectangle. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-xl border-4 border-farm-plotBorder pointer-events-none shadow-[inset_0_2px_10px_rgba(0,0,0,0.45)]"
      />
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/components/FarmGrid.test.tsx`
Expected: PASS, whole file.

- [ ] **Step 6: Confirm the sprites are crisp**

In the preview, plant a crop and compare a `ready` frame against a pre-Task-7 screenshot at
2× zoom. The sprite must be visibly sharper with the grain off its subtree. Use `computer`
with `{action: "zoom", region: [...]}` to inspect.

- [ ] **Step 7: Run the suite and linter**

Run: `npm test && npm run lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/FarmGrid.tsx tests/components/FarmGrid.test.tsx
git commit -m "feat(ui): migrate the farm grid onto the shared art vocabulary

The grid predates 018 and kept its T017 art: four hand-rolled inline SVGs
beside the real pixel-art PNGs, and a flat CSS border whose comment called
it a fence. The grain filter also sat on the wrapper, so it smudged the LPC
crop sprites that image-rendering: pixelated exists to keep sharp; it now
has its own layer."
```

---

## Task 8: Verification and backlog

**Files:**
- Modify: `backlog.md`

- [ ] **Step 1: Full verification sweep**

```bash
npm test && npm run lint && npm run build
```
Expected: PASS.

Run: `grep -rn "#[0-9A-Fa-f]\{3,8\}" src/components/ src/index.css`
Expected: matches only inside comments. No live literals.

- [ ] **Step 2: Real-device check**

Open the dev server on a physical phone. Confirm the farm reads as lit soil rather than a
dark pit, and that the HUD chips remain distinguishable from the field (spec §B3).

- [ ] **Step 3: Update the backlog**

Add a row to the Game Feel & Polish table, after `| F10 |` if 027 has landed, otherwise
after `| F8 |`:

```markdown
| F11 | ✅ **Farm scene coherence** — palette consolidation, play-surface and chrome lift, farm-grid art migration | Medium | M | [028-farm-scene-coherence](specs/028-farm-scene-coherence/spec.md) | **DONE.** 46 hardcoded hex literals across 5 components folded into `PALETTE`, so the contrast gate finally covers the surface the player looks at all game — which immediately exposed two labels at 2.89:1 (pest tile, exhausted tile), both now AA. Fields and HUD lifted out of near-black; the chrome lift was only possible by re-picking `danger`, which alone capped the available `chip` lift at 2.9% instead of 18.3%. Grid decor migrated from four inline SVGs to the 018 PNG registry, and the grain filter moved off the plot subtree where it was smudging the LPC crop sprites. |
```

Append to the F3 row's Notes cell, before its closing ` |`:

```markdown
 **Still open after 028** — deliberately excluded: different surface (Day Summary modal), different mechanism, no shared code with the farm-scene work.
```

Append to the F6 row's Notes cell, before its closing ` |`:

```markdown
 **Deferred to 029 by 028.** Cannot hang off `PageBackdrop`: it is `fixed`, `-z-10` and positioned in viewport percentages, so a building would sit behind the grid on a short viewport and in the open on a tall one. Needs a new in-flow farmyard container plus five new sprites.
```

- [ ] **Step 4: Commit**

```bash
git add backlog.md
git commit -m "docs(backlog): record 028, defer F6 to 029

Notes why F6 needs a new in-flow container rather than a PageBackdrop prop,
and why F3 was deliberately left out of the farm-scene work."
```

---

## Definition of done

- [ ] `npm test && npm run lint && npm run build` green.
- [ ] `grep -rn "#[0-9A-Fa-f]\{3,8\}" src/components/ src/index.css` matches only comments.
- [ ] `src/App.css` no longer exists.
- [ ] `tests/palette.contrast.test.ts` covers seven play-surface pairs and all pass.
- [ ] Tasks 2 and 3 were confirmed pixel-identical before Tasks 5–7 changed anything.
- [ ] The HUD chips are visually distinguishable from the farm bed (spec §B3).
- [ ] The critical-balance state still reads as a warning at the re-picked `danger`.
- [ ] Crop sprites are visibly crisper with the grain off their subtree.
- [ ] Real-device check done.
- [ ] No engine, schema, analytics or simulator file modified. Confirm with
      `git diff --stat master...HEAD` — `src/` changes should be limited to `theme/palette.ts`
      and the five components named in the file-structure table.
