# 029 — Release Polish

**Status:** Draft · **Date:** 2026-08-31 · **Effort:** M
**Scope source:** device review on the live Vercel deploy (iOS Safari), 2026-08-31
**Supersedes:** F10 (mobile HUD density) — see §A
**Goal of the phase:** make the game presentable for a public link.

---

## Problem

Three unrelated groups, bundled because they all block "I would send someone this link".

### 1. The mobile HUD wastes a row on things that do not earn it

At 360px the header renders two rows. Measured against the live build (328px usable
after the header's `px-4`):

| Element | Width |
|---|---|
| Day chip | 94 (**113** with the streak flame) |
| Balance chip | 151 |
| Lease chip | 61 |
| Actions group (`Last Turn` 99 + gear 44) | 151 |
| **Total for one row** | **500** |

Two of those do not justify their space:

- **The lease chip reads `−15/d`.** It was added by 027 for F7, specifically to surface the
  lease on mobile, and the compact form needed to fit the width budget communicates nothing.
  The backlog already recorded that the nightly charge is itemised in the Day Summary and
  called this "a planning affordance, not a safety fix". **027 was wrong here**; the honest
  move is to withdraw the mobile half rather than keep a meaningless glyph.
- **`Last Turn` is a re-open affordance.** The Day Summary opens automatically every turn.

### 2. Two visible defects

- **The balance chip's border is a different colour family from the whole game.** It is the
  low-balance warning working correctly (balance 43 ≤ lease 15 × 3), but it is painted
  `border-yellow-600/70` and `text-yellow-300` — **Tailwind's default palette, and the only
  two off-palette colours left in the codebase.** 028 consolidated hex *literals*; these are
  class names, so they slipped through, and `palette.contrast.test.ts` cannot see them
  either. Tailwind's yellow is greener than `gold` (#F5C842), which is why the warning reads
  as a style inconsistency instead of as a warning.
- **`Season reached` wraps to two lines on the bankruptcy screen.** `2 (Summer Heat)` is
  178px against 288px of row, and at `text-title` it does not fit beside its label.

### 3. Release scaffolding is still Vite's

- The favicon is `/vite.svg` — Vite's logo, in every tab and bookmark.
- The three README screenshots were committed **2026-03-20**, predating both the 018 art
  pass and 028's palette lift. They show a game that no longer looks like that, and they
  sit in `public/`, so ~2MB is deployed to the site root that nothing requests.
- No Open Graph or Twitter card tags, so a shared link previews bare.

## Goals

- One-row mobile HUD at 360px and above.
- No off-palette colours; the low-balance warning reads as a warning.
- Every bankruptcy stat value on one line.
- Nothing in the shipped page identifies as scaffolding.

## Non-goals

- **320px.** One row needs 303px of 288px available there; it stays two rows. Not chased.
- **The `🏆 New Best!` badge wrapping the `Season reached` *label*.** Out of scope by
  decision — the row grows to 48px only on a new best-season record, and the text stays
  readable.
- **PostHog production-key verification.** Explicitly dropped; the Vercel env var is assumed
  set.
- F3 (weather tint), F4 (final-day sequence), F6 (building sprites), G14 (achievements), F9
  (death-cause tuning) — all remain open, untouched.

---

## A. Mobile HUD to one row

Three changes, none sufficient alone:

| Arrangement | Total | Fits 328? |
|---|---|---|
| As shipped | 500 | ✗ |
| Drop lease only | 431 | ✗ |
| Drop `Last Turn` only | 393 | ✗ |
| Drop both | 324 | ✓ (4px spare) |
| **Drop both + hide the coin glyph** | **303** | **✓ (25px spare)** |
| …then §C's wider caption | **312** | **✓ (16px spare)** |

The 25px §A frees is not headroom to bank — §C spends 9 of it on a caption that actually
reads. The final shipped state is **312 of 328**.

1. **Hide the decorative 🪙 below `sm`** (−21px). It is already `aria-hidden`; the large gold
   number and the chip's `aria-label` carry the meaning. This is the 25px that pays for §C.
2. **Remove the lease chip below `sm`.** It keeps its `sm+` form, `Lease 15🪙/day`, including
   the end-of-season preview. `DailyLedgerChip` becomes `hidden sm:flex`.
3. **Move `Last Turn` into the gear menu.** A `View last turn` row using the popover's
   existing plain-row pattern (`role="menuitem"` + `ROW_CLASS`), `disabled` when
   `hasLastTurn` is false — `ROW_CLASS` already styles `disabled:`. The HUD button becomes
   `hidden sm:inline-flex`, mirroring how `Next Day` already does `hidden md:inline-flex`.

   The row exists **at all widths** rather than making menu contents responsive, so at `sm+`
   the action is reachable from both the HUD button and the menu. Deliberate duplication.

   Requires threading `onLastTurn` and `hasLastTurn` through `GameMenu` into
   `GameMenuPopover`, both of which currently receive neither.

### As-built measurement

Measured in Chromium against the running dev build (Task 5), header `<header>` at each
viewport. **Row-1 used** counts the widths of the first-row items plus their 8px gaps; the
budget is `viewport − 32` (the header's horizontal padding). Two loads are reported: the
one-row worst case (a live streak flame injected into the day chip) and the same plus the
widest contract chip the game can produce — a fifth element that was never part of the
one-row budget.

| Viewport | Load | Rows | Header height | Row-1 used | Available |
|---|---|---|---|---|---|
| 360px | baseline | 1 | 65px | 293px | 328px |
| 360px | + streak flame | **1** | 65px | **312px** | 328px |
| 360px | + streak + contract chip | 2 | 117px | 260px | 328px |
| 390px | baseline | 1 | 65px | 293px | 358px |
| 390px | + streak flame | 1 | 65px | 312px | 358px |
| 390px | + streak + contract chip | 2 | 117px | 260px | 358px |
| 320px | baseline | 2 | 117px | 241px | 288px |
| 320px | + streak flame | 2 | 117px | 260px | 288px |

The target viewports (360px, 390px) hold at **one row** under the streak-flame worst case,
landing at **312 of 328** at 360px exactly as designed. The contract chip is a fifth element
outside the one-row budget and legitimately wraps to a second row. **320px is two rows** at
every load — declared out of scope in §A's non-goals, and recorded here so that non-goal is
tested rather than assumed.

## B. Balance chip low-state palette

Add one token and use it for both halves of the warning:

```ts
/** Low-balance warning: warmer than `gold`, cooler than `danger`. */
warn: '#F0A830',
```

| State | Border | Value text |
|---|---|---|
| safe | `border-farm-chipBorder/60` | `text-farm-gold` (7.51) |
| **low** | `border-farm-warn/70` | **`text-farm-warn` (5.88)** |
| critical | `border-farm-red/80 animate-pulse` | `text-farm-danger` (5.63) |

This makes the ladder one hue family — gold → amber → salmon — so the low state reads as a
step along it rather than as a foreign colour. Add `warn`-on-`chip` to `PAIRS`, and check the
border against WCAG 1.4.11's 3:1 non-text threshold rather than 4.5 (the current
`yellow-600/70` measures 4.06, fine for a border, wrong for the palette).

## C. Season-goal caption

`Goal 105·D20` → `Goal 105 @D20`. The `·` reads as decoration rather than "by".

Measured with the coin hidden: `@D20` puts the balance chip at 139px and the row at **312 of
328** — 16px spare. Tight-spaced `@` is deliberate: `Goal 105 @ D20` costs 321 (7px spare)
and `Goal 105 by D20` costs 330 and does not fit.

## D. Gear icon → inline SVG

The gear carries a deliberate `-translate-y-[0.05em]` nudge whose comment records it as
measured *"against a 7x-magnified copy of the real button"* — in a Chromium preview. The
report is from iOS Safari, where Apple Color Emoji has different vertical metrics. **This
cannot be re-tuned in the preview browser**, and a value tuned for iOS may then be wrong on
Android.

Replace the `⚙️` glyph with an inline SVG gear: it centres identically everywhere, ends the
platform dependency, and removes both the nudge and the `brightness-125` hack. Draw it in
`currentColor` so it inherits the button's text colour and hover state instead of needing a
filter.

## E. Bankruptcy `Season reached` value

Split the value's type sizes rather than shrinking it wholesale:

```
value = <number at text-title> <name at text-caption>, both farm-gold
```

`2 (Summer Heat)` → `2 Summer Heat`. Parens dropped; brackets around a smaller-sized name
read as noise.

Measured at the true worst case `3 Autumn Pressure` (Autumn Pressure is the longest of the
five season names; endless mode is always "Deep Winter"): **138px**, one line, row height
40px — versus 193px and two lines today. Shrinking the whole value to `text-caption` also
fits (152px) but breaks the column's rhythm, where every other row is a full-size gold
number.

## F. Favicon

**Not derived from the crop sprite.** `parsnip_ready.png` is leaves on a soil mound — the
root is not visible, the mound eats half the pixels, and at 16×16 it downsamples to an
unrecognisable green blob. Verified by cropping and rescaling it.

Author a **pixel-grid SVG** instead: `<rect>` cells on an integer grid, shaped as a
recognisable parsnip (tapered cream root, green fronds), coloured from `PALETTE`. One file,
no build step, crisp at 16px and 32px alike, and immune to the platform-metric problem in §D.

Replace `<link rel="icon" href="/vite.svg">` and delete `public/vite.svg`.

## G. Screenshots

Recapture four shots against the current art — the three existing farm views plus a **shop**
shot — and move them to `docs/screenshots/`. The README renders them from there; `public/`
means they deploy to the site root where nothing requests them.

The three `![...](public/ScreenshotN.png)` links in `README.md:79–81` must be repointed to
the new path, and a fourth added for the shop shot. Moving the files without updating the
README silently breaks the images on GitHub.

The OG image (§H) is the exception: it must stay in `public/` to be fetchable by crawlers.

## H. Open Graph / Twitter meta

Add to `index.html`: `og:title`, `og:description`, `og:type`, `og:url`, `og:image`,
`twitter:card` (`summary_large_image`), and matching `twitter:` fields. Reuse the existing
`<meta name="description">` copy so there is one description, not two that drift.

`og:image` must be an absolute URL and needs real dimensions (1200×630 is the safe default),
so it is a purpose-sized export from one of §G's captures rather than a raw screenshot.

**Open item — the production origin.** `og:url` and `og:image` both need the real deployed
origin, absolute. The device screenshot shows a truncated `…ips.vercel.app`, which is
consistent with `pixel-parsnips.vercel.app` but is not proof. **Confirm the origin before
implementing §H**; do not guess it, because a wrong absolute URL makes every share preview
fail silently.

---

## Verification

- `npm test && npm run lint && npm run build` green.
- `grep -rnoE "(border|text|bg|ring)-(yellow|red|green|blue|amber|orange|slate|gray|zinc|neutral|stone|emerald|lime)-[0-9]{2,3}"  src/` returns nothing — proves §B closed the last off-palette gap.
- **Browser measurement at 360px** (jsdom cannot do this — no layout engine): header is one
  row under the streak-flame worst case, landing at 312 of the 328px budget. The widest
  contract chip is a fifth element outside that budget and wraps to a second row (see §A's
  as-built table) — record that two-row measurement as the documented exception, not a
  regression.
- Bankruptcy screen: every stat row is 40px and single-line, checked with
  `3 (Autumn Pressure)` forced.
- **Device check on the reporting device (iOS Safari)**: one-row HUD, gear centred, warning
  border reads as a warning. §D in particular cannot be signed off from the preview.
- Favicon renders as a parsnip at 16px in a real tab, not just in a 32px preview.
- Share preview: validate the OG tags resolve an image (any card validator, or fetch the
  built `index.html` and confirm absolute URLs).

## Backlog updates on ship

- **F10** → closed by §A, and its note **rewritten, not amended**. It currently claims the
  balance-chip caption is "the lever" and that the fix "needs the balance chip restructured".
  Both are false: de-tracking the caption saves 12px of the 13 needed and still leaves three
  rows, and the actual fix is three small removals. Record the 1px trap so it is not retried.
- **F7** → add a note that 029 withdrew its mobile half, and why.
- **F6** → its note says "Deferred to **029**", which this spec now occupies. Repoint it to
  "the next available spec number" rather than a hard number — reserving numbers ahead of
  writing them is what caused this.
- Add the four release-polish items as a single shipped row.
