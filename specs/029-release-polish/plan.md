# 029 — Release Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get the mobile HUD onto one row, close the last two off-palette colours, fix two typography defects, and replace the remaining Vite scaffolding — so the game is presentable at a public link.

**Architecture:** Presentation only. No engine, schema, analytics or simulator change. Tasks are ordered so each is independently verifiable: the palette and caption fixes land first (self-contained), then the three width reclamations that together produce the one-row HUD, then a browser measurement that proves it, then the standalone asset work.

**Tech Stack:** TypeScript ~5.6, React 18.3, Tailwind CSS 3.4, Vite 5.4, Vitest + Testing Library + vitest-axe.

**Branch:** `029-release-polish` (already checked out; the spec commit lives here).

**Spec:** [spec.md](spec.md). Read §A's width table before Tasks 3–5.

**Production origin:** `https://pixel-parsnips.vercel.app` (confirmed 2026-08-31).

---

## Critical constraints (read before starting)

1. **The width budget is the whole point of Tasks 3–5.** At 360px the header has **328px**.
   Tasks 3 and 4 free 21px + 61px + 99px; Task 2 spends 9px. The end state must be
   **312 of 328**, one row. Verify in a browser (Task 5) — jsdom has no layout engine, so
   `getBoundingClientRect` returns zeroes and no wrap is observable in a unit test.

2. **jsdom renders both responsive variants.** There is no Tailwind CSS in tests, so
   `hidden sm:flex` elements are still in the DOM with their text. A test that asserts
   something is "hidden on mobile" must assert the **class**, never absence from the DOM.

3. **Two tests currently assert the opposite of what this plan does** and must be inverted,
   not deleted — they are the record of a decision being reversed:
   - `HUD.test.tsx` → `shows the lease at mobile widths — the chip is never width-gated (F7)`
   - `HUD.test.tsx` → `keeps Last Turn on the HUD rather than in the menu`

4. **The SVG markup in Tasks 6 and 8 is verified.** Both were prototyped in a real browser at
   16px, 32px and 4× before this plan was written. Use them as given; do not "improve" the
   geometry without re-checking at 16px, where it breaks first.

---

## File structure

| File | Change | Responsibility after this plan |
|---|---|---|
| `src/theme/palette.ts` | Modify | Gains `warn`; still the only source of colour |
| `tailwind.config.ts` | Modify | Maps `warn` to `farm-warn` |
| `src/components/HUD.tsx` | Modify | One-row mobile header; warning uses palette |
| `src/components/GameMenu.tsx` | Modify | Threads last-turn props to the popover |
| `src/components/GameMenuPopover.tsx` | Modify | Gains the `View last turn` row |
| `src/components/BankruptcyScreen.tsx` | Modify | Season-reached value on one line |
| `public/favicon.svg` | **Create** | Pixel-grid parsnip |
| `public/vite.svg` | **Delete** | — |
| `public/og-image.png` | **Create** | 1200×630 share card |
| `docs/screenshots/*.png` | **Create** | Four current captures |
| `public/Screenshot{1,2,3}.png` | **Delete** | — (moved) |
| `index.html` | Modify | Favicon + OG/Twitter tags |
| `README.md` | Modify | Repointed screenshot links |
| `tests/palette.contrast.test.ts` | Modify | Gates `warn` |
| `tests/theme/noOffPalette.test.ts` | **Create** | Guards against class-name colour drift |
| `tests/components/HUD.test.tsx` | Modify | Width-gating + warning assertions |
| `tests/components/GameMenu.test.tsx` | Modify | Last-turn row |
| `tests/components/BankruptcyScreen.test.tsx` | Modify | Value format |
| `backlog.md` | Modify | Bookkeeping (Task 11) |

---

## Task 1: Low-balance warning joins the palette

**Files:**
- Modify: `src/theme/palette.ts`, `tailwind.config.ts`
- Modify: `src/components/HUD.tsx:28-33` and `:167-173`
- Test: `tests/palette.contrast.test.ts`, `tests/theme/noOffPalette.test.ts` (new), `tests/components/HUD.test.tsx`

`border-yellow-600/70` and `text-yellow-300` are Tailwind defaults — the only two off-palette
colours left. They are class names, so 028's hex-literal sweep missed them and the contrast
gate cannot see them.

- [ ] **Step 1: Write the failing guard test**

Create `tests/theme/noOffPalette.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 029 — 028 swept hardcoded hex *literals* into PALETTE, but Tailwind's default
 * colour classes are names, not hex, so `border-yellow-600/70` and
 * `text-yellow-300` survived it — and `palette.contrast.test.ts` could not see
 * them either. They were why the low-balance border read as a style
 * inconsistency rather than a warning. This test closes that hole for good.
 */
const TAILWIND_DEFAULT_HUES = [
  'slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber', 'yellow',
  'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet',
  'purple', 'fuchsia', 'pink', 'rose',
];
const OFF_PALETTE = new RegExp(
  `(?:^|[\\s"'\`:])(?:border|text|bg|ring|from|via|to|fill|stroke|shadow|outline|decoration|divide|accent|caret|placeholder)-(?:${TAILWIND_DEFAULT_HUES.join('|')})-\\d{2,3}`,
);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe('no off-palette colours', () => {
  const files = walk('src').filter((f) => /\.(tsx?|css)$/.test(f));

  it('finds source files to scan', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files)('%s uses only farm-* colour classes', (file) => {
    const offenders = readFileSync(file, 'utf8')
      .split('\n')
      .map((line, i) => ({ line, n: i + 1 }))
      .filter(({ line }) => OFF_PALETTE.test(line));
    expect(offenders.map((o) => `${file}:${o.n} ${o.line.trim()}`)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/theme/noOffPalette.test.ts`
Expected: FAIL on `src/components/HUD.tsx` — two offending lines listed,
`border-yellow-600/70` and `text-yellow-300`.

- [ ] **Step 3: Add the token**

In `src/theme/palette.ts`, after `danger`:

```ts
  /**
   * Low-balance warning. Warmer than `gold` and cooler than `danger`, so the
   * balance chip's safe → warn → critical ladder reads as one hue family. It
   * replaces Tailwind's `yellow-300`/`yellow-600`, whose greener yellow read as
   * a style inconsistency rather than as a warning.
   */
  warn: '#F0A830',
```

In `tailwind.config.ts`, inside `colors.farm`:

```ts
          warn: PALETTE.warn,
```

- [ ] **Step 4: Use it in the HUD**

Replace both helpers in `src/components/HUD.tsx`:

```tsx
function getBalanceBorderClass(danger: DangerLevel): string {
  if (danger === 'critical') return 'border-farm-red/80 animate-pulse';
  if (danger === 'low') return 'border-farm-warn/70';
  return 'border-farm-chipBorder/60';
}
```

```tsx
function getBalanceTextClass(danger: DangerLevel): string {
  // Lighter than farm-red so the "critical" balance keeps a ≥4.5:1 contrast
  // ratio against the dark farm-chip background (WCAG AA / Lighthouse a11y).
  if (danger === 'critical') return 'text-farm-danger';
  if (danger === 'low') return 'text-farm-warn';
  return 'text-farm-gold';
}
```

- [ ] **Step 5: Gate the new pair**

Add to `PAIRS` in `tests/palette.contrast.test.ts`:

```ts
  { name: 'low balance',        where: 'HUD.tsx balance chip',       fg: PALETTE.warn,      bg: PALETTE.chip },
```

The `/70` **border** is a non-text UI component: WCAG 1.4.11 asks 3:1, not 4.5:1, so it does
not belong in `PAIRS`. Add it to the documented-exceptions comment instead, with its measured
ratio, noting the 3:1 threshold it is judged against.

- [ ] **Step 6: Assert the HUD uses the token**

Add to `tests/components/HUD.test.tsx`:

```tsx
describe('HUD — 029 low-balance warning uses the palette', () => {
  it('paints the low state with farm-warn, not a Tailwind default', () => {
    // Season-1 lease is 15, so 43 is inside the low band (≤ 3× lease) but above critical.
    render(<HUD {...baseProps} currentDay={6} coinBalance={43} />);
    const coins = screen.getByLabelText(/coins: 43/i);
    expect(coins.className).toContain('text-farm-warn');
    expect(coins.className).not.toMatch(/yellow-\d/);
  });

  it('keeps gold for a comfortable balance and danger for a critical one', () => {
    const { unmount } = render(<HUD {...baseProps} currentDay={6} coinBalance={300} />);
    expect(screen.getByLabelText(/coins: 300/i).className).toContain('text-farm-gold');
    unmount();
    render(<HUD {...baseProps} currentDay={6} coinBalance={10} />);
    expect(screen.getByLabelText(/coins: 10/i).className).toContain('text-farm-danger');
  });
});
```

- [ ] **Step 7: Run everything**

Run: `npm test && npm run lint`
Expected: PASS, including the new guard test.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "fix(theme): bring the low-balance warning into the palette

border-yellow-600/70 and text-yellow-300 were the last two off-palette
colours. Being class names rather than hex literals, they survived 028's
sweep and stayed invisible to the contrast gate — and Tailwind's greener
yellow is why the warning border read as a style inconsistency instead of a
warning. A source-scanning test now closes that hole."
```

---

## Task 2: Season-goal caption

**Files:**
- Modify: `src/components/HUD.tsx` (mobile balance caption)
- Test: `tests/components/HUD.test.tsx:436`

`Goal 105·D20` — the `·` reads as decoration, not "by".

- [ ] **Step 1: Update the failing test first**

`tests/components/HUD.test.tsx:436` matches `/goal 105.D20/i`, where `.` is a single
wildcard character. The new caption has two characters between `105` and `D20`, so this
query stops matching. Change it to the literal:

```tsx
    const caption = screen.getByText(/goal 105 @D20/i).parentElement!;
```

And add a dedicated assertion:

```tsx
  it('uses @ rather than a middot between the goal and its deadline', () => {
    render(<HUD {...baseProps} currentDay={1} coinBalance={100} />);
    expect(screen.getByText('Goal 105 @D20')).toBeInTheDocument();
    expect(screen.queryByText(/Goal 105·D20/)).toBeNull();
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/components/HUD.test.tsx -t "middot"`
Expected: FAIL — `Unable to find an element with the text: Goal 105 @D20`.

- [ ] **Step 3: Change the caption**

In `src/components/HUD.tsx`, the balance chip's mobile caption span:

```tsx
              <span className="sm:hidden">Goal {season.target} @D{seasonLen}</span>
```

The `sm+` span (`Goal {season.target} by day {seasonLen}`) is unchanged — it has room for
real words.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/components/HUD.test.tsx`
Expected: PASS, whole file.

- [ ] **Step 5: Commit**

> Expect the mobile header to get *worse* at this point — the wider caption pushes the
> balance chip 151px → 160px, and Task 3 is what pays for it. Do not chase a row count
> until Task 5.

```bash
git add src/components/HUD.tsx tests/components/HUD.test.tsx
git commit -m "fix(hud): say @ instead of a middot in the mobile goal caption

'Goal 105·D20' read as decoration; the middot carried the word 'by'. Costs
9px of the 25px Task 3 frees, landing the row at 312 of 328."
```

---

## Task 3: Reclaim width — coin glyph and lease chip

**Files:**
- Modify: `src/components/HUD.tsx` (coin span; `DailyLedgerChip`)
- Test: `tests/components/HUD.test.tsx`

Frees 21px + 61px. Neither alone gets the header to one row (see spec §A) — both are needed,
along with Task 4.

- [ ] **Step 1: Invert the F7 test**

In `tests/components/HUD.test.tsx`, replace the test named
`shows the lease at mobile widths — the chip is never width-gated (F7)` with:

```tsx
  // 029 reverses 027's F7 decision for mobile only. The chip existed to surface the lease
  // below 640px, but the compact form it needed to fit the width budget — `−15/d` — was
  // measured on a real device as communicating nothing. The nightly charge is itemised in
  // the Day Summary, so withdrawing the mobile chip costs little and buys the header row.
  it('hides the whole ledger chip below sm (029 reverses F7 on mobile)', () => {
    render(<HUD {...baseProps} currentDay={5} coinBalance={100} />);
    const chip = screen.getByLabelText(/lease: 15 coins per day/i);
    expect(chip.className).toMatch(/(^|\s)hidden(\s|$)/);
    expect(chip.className).toMatch(/sm:flex/);
  });

  it('carries no mobile-only lease form any more', () => {
    render(<HUD {...baseProps} currentDay={5} coinBalance={100} />);
    const chip = screen.getByLabelText(/lease: 15 coins per day/i);
    expect(chip.querySelectorAll('.sm\\:hidden')).toHaveLength(0);
  });
```

Then delete these three now-meaningless tests from the same describe block, since the mobile
form they assert against no longer exists:
- `shows the lease at streak 0`
- `keeps the same lease form when a streak is live`
- `keeps emoji out of the mobile form (width budget — see spec.md)`

Replace the first with an `sm+` equivalent:

```tsx
  it('shows the full lease form at sm+', () => {
    render(<HUD {...baseProps} currentDay={5} coinBalance={100} />);
    expect(screen.getByLabelText(/lease: 15 coins per day/i)).toHaveTextContent(/Lease 15/);
  });
```

Keep the `mobileText` helper only if another test in the block still uses it; otherwise
delete it — an unused function fails `npm run lint`.

- [ ] **Step 2: Add the coin-glyph test**

```tsx
  it('hides the decorative coin glyph below sm to buy header width', () => {
    render(<HUD {...baseProps} currentDay={1} coinBalance={130} />);
    const chip = screen.getByLabelText(/coins: 130/i).closest('[data-coin-target]')!;
    const coin = [...chip.querySelectorAll('span')].find(s => s.textContent === '🪙')!;
    expect(coin.className).toMatch(/(^|\s)hidden(\s|$)/);
    expect(coin.className).toMatch(/sm:inline/);
  });
```

- [ ] **Step 3: Run to verify the new tests fail**

Run: `npx vitest run tests/components/HUD.test.tsx -t "029"`
Expected: FAIL — the chip has no `hidden` class and the coin has no `hidden` class.

- [ ] **Step 4: Hide the coin glyph below sm**

In the balance chip:

```tsx
          <span className="hidden sm:inline text-lg leading-none" aria-hidden="true">🪙</span>
```

It is already `aria-hidden`, so nothing is lost semantically — the large gold number and the
chip's `aria-label` carry the meaning.

- [ ] **Step 5: Gate the ledger chip to sm+ and drop its mobile form**

In `DailyLedgerChip`, change the root element's class list so it starts `hidden sm:flex`:

```tsx
      className="hidden sm:flex items-center gap-1 bg-farm-chip px-2.5 py-1 rounded border border-farm-chipBorder/60 cursor-help"
```

Delete the mobile span and unwrap the `sm+` one, which no longer needs its sibling:

```tsx
      <span className="font-pixel text-caption text-farm-parchment/70 uppercase tracking-widest">
        Lease {leasePerDay}<Coin />/day
        {nextSeasonLease !== null && (
          <span className="ml-1 text-farm-gold/70">
            (rises to {nextSeasonLease} next season)
          </span>
        )}
      </span>
```

Then rewrite the component's doc comment. Its current `WIDTH BUDGET` paragraph describes a
mobile form that no longer exists:

```tsx
/**
 * The per-day coin ledger: the lease you owe, every night. Desktop only.
 *
 * 027 introduced this to surface the lease below 640px (F7). A device review of the live
 * build found the compact form that fit the mobile width budget — `−15/d` — communicated
 * nothing, so 029 withdrew the mobile half: the chip is `hidden sm:flex`, and mobile
 * players read the nightly charge in the Day Summary, where it is itemised. The 61px this
 * frees is part of what gets the mobile header onto one row (specs/029-release-polish §A).
 *
 * COLOUR: `farm-stone` is unusable here — it measures 3.751 on `farm-chip` and fails WCAG
 * AA. The cost uses `farm-parchment/70` (7.06) and the preview `farm-gold/70` (5.47).
 */
```

- [ ] **Step 6: Run the suite and linter**

Run: `npm test && npm run lint`
Expected: PASS. `GameBoard` tests that query the lease still pass — jsdom keeps
`hidden sm:flex` elements in the DOM with their text.

- [ ] **Step 7: Commit**

```bash
git add src/components/HUD.tsx tests/components/HUD.test.tsx
git commit -m "feat(hud): reclaim 82px of mobile header width

Hides the decorative coin glyph below sm (21px) and withdraws the mobile
lease chip (61px). A device review found `−15/d` communicated nothing, so
027's F7 decision is reversed for mobile only — the sm+ chip keeps the full
'Lease 15🪙/day' form, and the Day Summary still itemises the charge."
```

---

## Task 4: Last Turn moves into the gear menu

**Files:**
- Modify: `src/components/HUD.tsx` (button class; `GameMenu` call)
- Modify: `src/components/GameMenu.tsx` (props → popover)
- Modify: `src/components/GameMenuPopover.tsx` (new row)
- Test: `tests/components/HUD.test.tsx`, `tests/components/GameMenu.test.tsx`

Frees the last 99px. The Day Summary opens automatically each turn, so the HUD button is a
re-open affordance — cheap to relocate, and the menu is one tap away.

- [ ] **Step 1: Invert the HUD test**

Replace the test named `keeps Last Turn on the HUD rather than in the menu`:

```tsx
  // 029 — the button costs 99px of a 328px mobile header. It is a re-open affordance (the
  // Day Summary opens itself each turn), so below sm it lives in the gear menu instead.
  it('gates the Last Turn button to sm+ and keeps it in the DOM', () => {
    render(<HUD {...baseProps} currentDay={1} coinBalance={100} hasLastTurn />);
    const button = screen.getByRole('button', { name: /view last turn summary/i });
    expect(button.className).toMatch(/(^|\s)hidden(\s|$)/);
    expect(button.className).toMatch(/sm:inline-flex/);
  });
```

- [ ] **Step 2: Thread the props**

`src/components/HUD.tsx` — the `GameMenu` call gains two props:

```tsx
          <GameMenu
            onRestart={onRestart}
            onReplayTutorial={onReplayTutorial}
            onLastTurn={onLastTurn}
            hasLastTurn={hasLastTurn}
          />
```

`src/components/GameMenu.tsx` — extend the interface:

```tsx
interface GameMenuProps {
  /** Abandons the live run and starts a fresh one. */
  onRestart: () => void;
  /** Flags the tutorial for replay and restarts the run. */
  onReplayTutorial: () => void;
  /** 029 — reopens the previous turn's Day Summary. Below sm this menu is the
      only way to reach it; the HUD button is `hidden sm:inline-flex`. */
  onLastTurn: () => void;
  /** False when there is no previous turn to reopen; disables the row. */
  hasLastTurn: boolean;
}
```

Destructure them and pass them through:

```tsx
export function GameMenu({ onRestart, onReplayTutorial, onLastTurn, hasLastTurn }: GameMenuProps) {
```

```tsx
          <GameMenuPopover
            popoverRef={popoverRef}
            rowSelector={ANY_ROW}
            onRestart={onRestart}
            onReplayTutorial={onReplayTutorial}
            onLastTurn={onLastTurn}
            hasLastTurn={hasLastTurn}
            dismiss={() => setOpen(false)}
            onOpenCredits={openCredits}
          />
```

- [ ] **Step 3: Add the row**

`src/components/GameMenuPopover.tsx` — extend `GameMenuPopoverProps`:

```tsx
  /** 029 — reopens the previous turn's Day Summary. */
  onLastTurn: () => void;
  /** False when there is no previous turn to reopen. */
  hasLastTurn: boolean;
```

Destructure them, then add the row as the **first** item in the menu — it is the only
gameplay-adjacent action here and the most likely reason to open the menu on a phone. Place
it immediately above the `ArmedRow` for restart, using the existing plain-row pattern:

```tsx
        <button
          type="button"
          role="menuitem"
          disabled={!hasLastTurn}
          onClick={() => {
            dismiss();
            onLastTurn();
          }}
          className={ROW_CLASS}
        >
          View last turn
        </button>
```

`ROW_CLASS` already styles `disabled:opacity-60 disabled:hover:bg-transparent`, so the
disabled state needs no extra classes.

The row renders at **all** widths rather than making menu contents responsive, so at `sm+`
the action is reachable from both the HUD button and the menu. Deliberate duplication.

- [ ] **Step 4: Gate the HUD button to sm+**

Add `hidden sm:inline-flex` to the Last Turn button's class list, mirroring how the Next Day
button already does `hidden md:inline-flex`:

```tsx
            className="
              hidden sm:inline-flex
              font-pixel text-caption px-2 py-1.5 min-h-[44px] md:min-h-0 rounded uppercase tracking-widest
              bg-farm-chip text-farm-stone/60 border border-farm-chipBorder/50
              hover:enabled:bg-farm-chipHover hover:enabled:text-farm-parchment/80 hover:enabled:border-farm-chipBorder
              active:enabled:scale-95 transition-all
              disabled:opacity-30
            "
```

- [ ] **Step 5: Update the GameMenu test harness**

`tests/components/GameMenu.test.tsx` renders `<GameMenu onRestart={noop} onReplayTutorial={noop} />`
in **17 places**. Add a shared props object after the `noop` declaration:

```tsx
const noop = () => {};
const menuProps = {
  onRestart: noop,
  onReplayTutorial: noop,
  onLastTurn: noop,
  hasLastTurn: true,
};
```

Then replace every occurrence mechanically:

```bash
sed -i '' 's|<GameMenu onRestart={noop} onReplayTutorial={noop} />|<GameMenu {...menuProps} />|g' tests/components/GameMenu.test.tsx
grep -c "GameMenu {...menuProps}" tests/components/GameMenu.test.tsx   # expect 17
grep -c "onRestart={noop} onReplayTutorial={noop}" tests/components/GameMenu.test.tsx  # expect 0
```

Some tests pass their own `onRestart` spy — leave those, but add the two new props to them.
Find them with:

```bash
grep -n "<GameMenu" tests/components/GameMenu.test.tsx
```

- [ ] **Step 6: Test the new row**

Add to `tests/components/GameMenu.test.tsx`:

```tsx
describe('GameMenu — 029 last-turn row', () => {
  it('reopens the previous turn and closes the menu', async () => {
    const onLastTurn = vi.fn();
    render(<GameMenu {...menuProps} onLastTurn={onLastTurn} />);
    await openMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: /view last turn/i }));
    expect(onLastTurn).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('is disabled when there is no previous turn', async () => {
    const onLastTurn = vi.fn();
    render(<GameMenu {...menuProps} hasLastTurn={false} onLastTurn={onLastTurn} />);
    await openMenu();
    const row = screen.getByRole('menuitem', { name: /view last turn/i });
    expect(row).toBeDisabled();
    await userEvent.click(row);
    expect(onLastTurn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 7: Run the suite and linter**

Run: `npm test && npm run lint`
Expected: PASS. Note `GameBoard.celebration.test.tsx:145` clicks the HUD button by its
accessible name — still present in the DOM, so it keeps working. If any test now matches
**two** elements named `/last turn/i`, it is because the menu is open; scope the query with
`getByRole('button', …)` versus `getByRole('menuitem', …)`.

- [ ] **Step 8: Verify the menu is still accessible**

Run: `npx vitest run tests/components/GameMenu.test.tsx -t "accessibility"`
Expected: PASS — the existing axe test covers the menu while open, now with the extra row.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(hud): move Last Turn into the gear menu below sm

Frees the last 99px needed for a one-row mobile header. The Day Summary
opens itself each turn, so the HUD button is a re-open affordance; it stays
at sm+ and the menu carries a 'View last turn' row at every width."
```

---

## Task 5: Prove the one-row header in a browser

**Files:**
- Modify: `specs/029-release-polish/spec.md` (record the measurement)

This cannot be a unit test — jsdom has no layout engine.

- [ ] **Step 1: Start the preview**

Use the `preview_start` tool with `{name: "dev"}`. **Read the returned port from
`preview_logs`, not from the tool result** — Vite picks its own port when 5173 is taken, and
the two can disagree. Then `navigate` to `http://localhost:<actual port>/`.

- [ ] **Step 2: Set the viewport to 360px**

`resize_window` with `{width: 360, height: 780, tabId: "<tabId>"}`.

- [ ] **Step 3: Measure the header under worst-case load**

Run via `javascript_tool`. This injects the widest contract chip the game can produce and a
streak flame into the day chip, then counts distinct row offsets.

```js
(() => {
  const h = document.querySelector('header');
  const holder = h.querySelector('.contents');
  const inner = holder.children[0].querySelector('span.flex.items-center');
  const chip = (html) => { const d=document.createElement('div'); d.className='flex items-center gap-1 bg-farm-chip px-2.5 py-1 rounded border border-farm-chipBorder/60'; d.innerHTML=html; d.dataset.probe='1'; return d; };
  const flame = document.createElement('span'); flame.dataset.probe='1'; flame.className='inline-flex';
  flame.innerHTML='<span class="inline-block text-base leading-none">🔥</span>';
  const measure = () => {
    const items=[...h.querySelectorAll('*')]
      .filter(e=>e.parentElement===h||(e.parentElement&&e.parentElement.className==='contents'))
      .filter(e=>e.getBoundingClientRect().width>0);
    const tops = new Set(items.map(e=>Math.round(e.getBoundingClientRect().top)));
    const row1 = items.filter(e=>Math.round(e.getBoundingClientRect().top)===Math.min(...tops));
    return { rows: tops.size, headerH: Math.round(h.getBoundingClientRect().height),
      row1Used: row1.reduce((s,e)=>s+Math.round(e.getBoundingClientRect().width),0) + 8*(row1.length-1),
      available: window.innerWidth - 32 };
  };
  const out = { viewport: window.innerWidth, baseline: measure() };
  inner.appendChild(flame);
  out.withStreak = measure();
  holder.appendChild(chip('<span class="text-base leading-none">📜</span><span class="font-pixel text-caption text-farm-gold">10/10 · 12d</span>'));
  out.withStreakAndContract = measure();
  [...h.querySelectorAll('[data-probe]')].forEach(e=>e.remove());
  return out;
})()
```

Expected: `rows: 1` for `baseline` and `withStreak`, with `row1Used` ≈ **312** of
**328**. `withStreakAndContract` may legitimately be 2 rows — the contract chip is a fifth
element and was never part of the one-row budget; record whichever it is.

If `baseline` is not 1 row, a previous task is incomplete. Check in order: coin glyph hidden
(Task 3), ledger chip `hidden sm:flex` (Task 3), Last Turn `hidden sm:inline-flex` (Task 4).

- [ ] **Step 4: Screenshot for the record**

`computer` with `{action: "screenshot", tabId: "<tabId>"}` at 360px.

- [ ] **Step 5: Check 390px and 320px**

Repeat Step 3 at `{width: 390}` (expect 1 row, more headroom) and `{width: 320}` (expect 2
rows — spec §A declares 320px out of scope). Recording the 320px result is what makes that
non-goal honest rather than untested.

- [ ] **Step 6: Record the numbers in the spec**

Append an "As-built measurement" subsection to spec §A with a table of columns
**Viewport | Rows | Row-1 used | Available**, filled from Steps 3 and 5. Write the real
integers; do not commit the table with a cell unfilled.

- [ ] **Step 7: Reset the viewport**

`resize_window` with `{preset: "desktop", tabId: "<tabId>"}`.

- [ ] **Step 8: Commit**

```bash
git add specs/029-release-polish/spec.md
git commit -m "docs(specs): record 029's as-built header measurements"
```

---

## Task 6: Gear icon becomes an inline SVG

**Files:**
- Modify: `src/components/GameMenu.tsx`
- Test: `tests/components/GameMenu.test.tsx`

The current glyph carries a `-translate-y-[0.05em]` nudge measured in a Chromium preview; the
device report is iOS Safari, where Apple Color Emoji has different vertical metrics. An SVG
centres identically everywhere and removes the nudge and the `brightness-125` hack together.

**The markup below was prototyped in a browser at 44px and 4× before this plan was written.**

- [ ] **Step 1: Write the failing test**

```tsx
describe('GameMenu — 029 gear icon', () => {
  it('draws the gear as inline SVG, not an emoji', () => {
    const { container } = render(<GameMenu {...menuProps} />);
    const gear = screen.getByRole('button', { name: /game menu/i });
    expect(gear.querySelector('svg')).not.toBeNull();
    expect(gear.textContent).toBe('');
  });

  it('needs no platform-specific optical nudge', () => {
    const { container } = render(<GameMenu {...menuProps} />);
    const gear = screen.getByRole('button', { name: /game menu/i });
    expect(gear.innerHTML).not.toMatch(/translate-y/);
    expect(gear.innerHTML).not.toMatch(/brightness/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/components/GameMenu.test.tsx -t "029 gear"`
Expected: FAIL — no `svg` found, and `textContent` is the ⚙️ glyph.

- [ ] **Step 3: Replace the glyph**

In `src/components/GameMenu.tsx`, replace the icon `<span>` and its whole comment block with:

```tsx
        {/* 029 — an inline SVG, not ⚙️. The emoji needed a hand-measured optical nudge,
            and that measurement is per-platform: tuned against Chromium's emoji font, it
            read off-centre in iOS Safari, where Apple Color Emoji has different vertical
            metrics. An SVG centres by geometry on every platform, and `currentColor` means
            it inherits the button's hover colour instead of needing a brightness filter.
            Geometry verified at 44px and 4x in a browser; it breaks first at 16px. */}
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="h-[22px] w-[22px] text-farm-parchment/90"
        >
          <rect x="6.5" y="0" width="3" height="4" />
          <rect x="6.5" y="12" width="3" height="4" />
          <rect x="0" y="6.5" width="4" height="3" />
          <rect x="12" y="6.5" width="4" height="3" />
          <rect x="1.8" y="2.6" width="3" height="3" transform="rotate(45 3.3 4.1)" />
          <rect x="11.2" y="2.6" width="3" height="3" transform="rotate(45 12.7 4.1)" />
          <rect x="1.8" y="10.4" width="3" height="3" transform="rotate(45 3.3 11.9)" />
          <rect x="11.2" y="10.4" width="3" height="3" transform="rotate(45 12.7 11.9)" />
          <path fillRule="evenodd" d="M8 3a5 5 0 100 10A5 5 0 008 3zm0 3a2 2 0 110 4 2 2 0 010-4z" />
        </svg>
```

Note `fillRule` (camelCase) — React warns on `fill-rule` in JSX.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/components/GameMenu.test.tsx`
Expected: PASS, whole file including the axe test.

- [ ] **Step 5: Verify it renders as a gear**

In the preview, screenshot the header and use `computer` with
`{action: "zoom", region: [...]}` on the gear button. It must read as an eight-toothed gear
with a round hub hole, centred in its button, and it must change colour on hover.

- [ ] **Step 6: Run the suite and commit**

Run: `npm test && npm run lint`

```bash
git add src/components/GameMenu.tsx tests/components/GameMenu.test.tsx
git commit -m "fix(ui): draw the gear as inline SVG instead of an emoji

The emoji needed a hand-measured optical nudge, and that measurement is
per-platform: tuned in Chromium, it read off-centre on iOS Safari. Geometry
centres the SVG on every platform, and currentColor replaces the brightness
filter."
```

---

## Task 7: Bankruptcy season-reached value on one line

**Files:**
- Modify: `src/components/BankruptcyScreen.tsx`
- Test: `tests/components/BankruptcyScreen.test.tsx`

`2 (Summer Heat)` at `text-title` measures 178px against 288px of row and wraps, taking its
label with it. Splitting the type sizes fits the worst case in 138px.

- [ ] **Step 1: Write the failing test**

The file already has `renderScreen(props: Partial<ComponentProps<typeof BankruptcyScreen>>)`
at the top — use it, do not add another helper.

**Pass `daysPlayed` and `seasonReached` together.** The component derives the season *name*
from `daysPlayed` (`const season = getSeasonForDay(daysPlayed)` at line 75) while the
*number* comes from the `seasonReached` prop. They are independent, so `{ seasonReached: 2 }`
alone against the helper's default `daysPlayed: 12` renders "2 Spring Thaw". Season day
ranges: S1 1–20, S2 21–40, S3 41–60, S4 61–80.

```tsx
// 029 — `2 (Summer Heat)` wrapped to two lines at text-title. The season *number* stays
// full size, matching every other row's hero number; only the name is demoted. Parens go,
// because brackets around a smaller-sized name read as noise.
describe('BankruptcyScreen — 029 season-reached value', () => {
  it('renders the number and name without parentheses', () => {
    renderScreen({ daysPlayed: 25, seasonReached: 2 });
    expect(screen.getByText('Summer Heat')).toBeInTheDocument();
    expect(screen.queryByText(/\(Summer Heat\)/)).toBeNull();
  });

  it('keeps the season number at title size and demotes only the name', () => {
    renderScreen({ daysPlayed: 25, seasonReached: 2 });
    const name = screen.getByText('Summer Heat');
    expect(name.className).toContain('text-caption');
    const value = name.parentElement!;
    expect(value.className).toContain('text-title');
    expect(value.textContent).toMatch(/^2\s*Summer Heat$/);
  });

  // The longest value the game can produce: Autumn Pressure is the longest of the five
  // season names, and endless mode is always "Deep Winter".
  it('handles the longest possible season name', () => {
    renderScreen({ daysPlayed: 45, seasonReached: 3 });
    const name = screen.getByText('Autumn Pressure');
    expect(name.parentElement!.textContent).toMatch(/^3\s*Autumn Pressure$/);
  });
});
```

> Observation, not in scope: the number and the name come from different sources and can
> disagree (a run ending on day 12 with `seasonReached: 2` renders "2 Spring Thaw"). That is
> pre-existing. Do not fix it here — note it if it looks reachable in real play.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/components/BankruptcyScreen.test.tsx -t "029 season-reached"`
Expected: FAIL — `Unable to find an element with the text: Summer Heat` (it is currently
inside the string `2 (Summer Heat)`, not its own element).

- [ ] **Step 3: Split the value**

In `src/components/BankruptcyScreen.tsx`, replace the `Season reached` row's `value` prop:

```tsx
        <StatRow
          label="Season reached"
          value={
            <>
              {seasonReached}
              <span className="text-caption ml-1.5">{season.name}</span>
            </>
          }
          isNewBest={newBests.has('bestSeasonReached')}
        />
```

The name inherits `font-pixel text-title text-farm-gold` from `StatRow`'s span and overrides
only the size, so it stays gold — size alone carries the hierarchy.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/components/BankruptcyScreen.test.tsx`
Expected: PASS, whole file. The existing `getByText(/Season reached/i)` label assertion is
unaffected.

- [ ] **Step 5: Verify the worst case in a browser**

The longest value is `3 Autumn Pressure` — Autumn Pressure is the longest of the five season
names, and endless mode is always "Deep Winter". In the preview, render the bankruptcy screen
with `seasonReached: 3` (drive a run to bankruptcy in season 3, or temporarily hard-code it)
and confirm the row is a single 40px line.

- [ ] **Step 6: Run the suite and commit**

Run: `npm test && npm run lint`

```bash
git add src/components/BankruptcyScreen.tsx tests/components/BankruptcyScreen.test.tsx
git commit -m "fix(ui): fit the bankruptcy season-reached value on one line

'2 (Summer Heat)' wrapped at text-title and dragged its label onto two
lines with it. The season number keeps full size, matching every other row's
hero number; only the name drops to caption. Worst case '3 Autumn Pressure'
measures 138px of 288px."
```

---

## Task 8: Parsnip favicon

**Files:**
- Create: `public/favicon.svg`
- Delete: `public/vite.svg`
- Modify: `index.html`

**Not derived from `parsnip_ready.png`.** That sprite is leaves on a soil mound — the root is
not visible, the mound eats half the pixels, and at 16×16 it downsamples to an unrecognisable
green blob. Verified by cropping and rescaling it.

The markup below was prototyped in a browser at 16px, 32px and 10× before this plan was
written, against two rejected alternatives.

- [ ] **Step 1: Create the favicon**

Create `public/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">
  <!--
    029 — pixel-grid parsnip: tapered cream root, green fronds, on a 16x16 grid so
    it stays crisp at both 16px and 32px. Verified legible at 16px, where the
    silhouette is all that survives.

    A standalone asset cannot import PALETTE, so these are literals by necessity.
    They mirror: cropParsnipBorder #4E8A2E, grass #357028, awningCream #E8D9A8.
    The shading tone #C8B486 exists only here. Keep them in step with the palette
    by hand if it changes.
  -->
  <rect x="1" y="0" width="3" height="4" fill="#357028"/>
  <rect x="12" y="0" width="3" height="4" fill="#357028"/>
  <rect x="4" y="0" width="8" height="4" fill="#4E8A2E"/>
  <rect x="2" y="4" width="12" height="3" fill="#E8D9A8"/>
  <rect x="3" y="7" width="10" height="3" fill="#E8D9A8"/>
  <rect x="5" y="10" width="6" height="3" fill="#E8D9A8"/>
  <rect x="7" y="13" width="2" height="3" fill="#E8D9A8"/>
  <rect x="10" y="4" width="4" height="3" fill="#C8B486"/>
  <rect x="10" y="7" width="3" height="3" fill="#C8B486"/>
  <rect x="9" y="10" width="2" height="3" fill="#C8B486"/>
</svg>
```

- [ ] **Step 2: Point index.html at it and drop the Vite logo**

In `index.html`, replace the icon link:

```html
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

```bash
grep -rn "vite.svg" index.html src/ public/ README.md   # expect no output
git rm public/vite.svg
```

- [ ] **Step 3: Verify at real favicon sizes**

Build and preview, then confirm the tab icon reads as a parsnip — **not** just in a 32px
preview. Open `http://localhost:<port>/favicon.svg` directly and zoom, then check the browser
tab itself, which renders at 16px on a standard-DPI display.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(ui): replace the Vite logo favicon with a pixel parsnip

A pixel-grid SVG rather than a crop of parsnip_ready.png: that sprite is
leaves on a soil mound with no visible root, and it downsamples to an
unrecognisable blob at 16px. Verified legible at 16px and 32px."
```

---

## Task 9: Recapture the screenshots

**Files:**
- Create: `docs/screenshots/*.png` (four)
- Delete: `public/Screenshot{1,2,3}.png`
- Modify: `README.md:79-81`

The existing three were committed **2026-03-20**, predating both the 018 art pass and 028's
palette lift, so they show a game that no longer looks like that. They also sit in `public/`,
so ~2MB deploys to the site root that nothing requests.

- [ ] **Step 1: Capture four shots**

Start the preview (reading the real port from `preview_logs`), then capture with `computer`
`{action: "screenshot"}`:

1. **Farm mid-run** — several plots growing, a streak flame live if possible
2. **Farm with a disaster or exhausted plots** — shows the failure texture
3. **Day Summary** — the harvest/lease/tax breakdown
4. **Shop** — seed cards and the Buildings track (this is the new one)

Play a real run to reach these states rather than forcing props; the point is that these are
the game as shipped. Use the default desktop viewport so the shots match the README's
presentation.

- [ ] **Step 2: Save them into the repo**

```bash
mkdir -p docs/screenshots
```

Save the four captures as `docs/screenshots/farm.png`, `disaster.png`, `day-summary.png` and
`shop.png`. Descriptive names, not `Screenshot1` — the old numbering carried no information.

- [ ] **Step 3: Repoint the README**

`README.md:79-81` currently reads:

```markdown
![Farm grid screenshot](public/Screenshot1.png)
![Farm grid screenshot](public/Screenshot2.png)
![Farm grid screenshot](public/Screenshot3.png)
```

All three share one alt text that describes only the first. Replace with four lines with real
alt text:

```markdown
![The farm mid-run, with crops at several growth stages](docs/screenshots/farm.png)
![Exhausted and disaster-hit plots](docs/screenshots/disaster.png)
![The Day Summary breaking down harvest income, lease and tax](docs/screenshots/day-summary.png)
![The shop, showing seed cards and the buildings track](docs/screenshots/shop.png)
```

- [ ] **Step 4: Remove the deployed copies**

```bash
git rm public/Screenshot1.png public/Screenshot2.png public/Screenshot3.png
grep -rn "Screenshot[123]" . --exclude-dir=node_modules --exclude-dir=.git   # expect no output
```

- [ ] **Step 5: Confirm the README renders**

Check that every image path resolves from the repo root — a broken README image is the most
visible possible regression on a portfolio project. Verify each file exists at the path the
markdown names:

```bash
for f in farm disaster day-summary shop; do test -f "docs/screenshots/$f.png" && echo "ok $f" || echo "MISSING $f"; done
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: recapture screenshots against the current art

The three in public/ were from 2026-03-20, predating both the 018 art pass
and 028's palette lift. Adds a shop shot, gives each real alt text, and
moves them to docs/screenshots/ so ~2MB stops deploying to the site root
where nothing requests it."
```

---

## Task 10: Open Graph and Twitter card

**Files:**
- Create: `public/og-image.png`
- Modify: `index.html`

Production origin: `https://pixel-parsnips.vercel.app`.

- [ ] **Step 1: Build the share card**

`og:image` needs real dimensions — 1200×630 is the safe default — so it is a purpose-sized
export, not a raw screenshot. Compose one from the Task 9 farm capture, padded or cropped to
exactly 1200×630 on the page background colour (`#241806`):

```bash
python3 - <<'PY'
from PIL import Image
src = Image.open('docs/screenshots/farm.png').convert('RGB')
W, H = 1200, 630
card = Image.new('RGB', (W, H), (36, 24, 6))
scale = min(W / src.width, H / src.height)
fit = src.resize((round(src.width * scale), round(src.height * scale)), Image.LANCZOS)
card.paste(fit, ((W - fit.width) // 2, (H - fit.height) // 2))
card.save('public/og-image.png', optimize=True)
print('og-image.png', card.size)
PY
```

Confirm it is under ~1MB; crawlers reject very large cards.

- [ ] **Step 2: Add the tags**

In `index.html`, inside `<head>` after the existing description meta. Reuse the same
description string rather than writing a second one that can drift:

```html
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Pixel Parsnips" />
    <meta property="og:title" content="Pixel Parsnips" />
    <meta
      property="og:description"
      content="Pixel Parsnips — a cozy pixel-art farming tycoon. Plant crops, manage your plots, and survive seasonal disasters across each 20-day run."
    />
    <meta property="og:url" content="https://pixel-parsnips.vercel.app/" />
    <meta property="og:image" content="https://pixel-parsnips.vercel.app/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="The Pixel Parsnips farm grid, with crops at several growth stages" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Pixel Parsnips" />
    <meta
      name="twitter:description"
      content="Pixel Parsnips — a cozy pixel-art farming tycoon. Plant crops, manage your plots, and survive seasonal disasters across each 20-day run."
    />
    <meta name="twitter:image" content="https://pixel-parsnips.vercel.app/og-image.png" />
```

Both URLs must be **absolute** — relative ones fail silently in most crawlers.

- [ ] **Step 3: Verify the built output**

```bash
npm run build
grep -c "og:image" dist/index.html          # expect 4 (image, width, height, alt)
grep -o 'https://pixel-parsnips.vercel.app[^"]*' dist/index.html | sort -u
test -f dist/og-image.png && echo "card copied into dist"
```

Expected: the URLs listed are the site root and `/og-image.png`, and the card is in `dist/`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(meta): add Open Graph and Twitter card tags

Shared links previewed bare. Absolute URLs against pixel-parsnips.vercel.app
(relative ones fail silently in crawlers), and a purpose-sized 1200x630 card
rather than a raw screenshot. Description is reused from the existing meta so
there is one string, not two that drift."
```

---

## Task 11: Backlog and final verification

**Files:**
- Modify: `backlog.md`

- [ ] **Step 1: Full sweep**

```bash
npm test && npm run lint && npm run build
```
Expected: PASS.

```bash
grep -rn "vite.svg\|Screenshot[123]" . --exclude-dir=node_modules --exclude-dir=.git
```
Expected: no output — proves the scaffolding is gone.

- [ ] **Step 2: Rewrite F10's note**

F10's current note is **wrong** and must be replaced, not amended. It claims the balance-chip
caption is "the lever" and that the fix "needs the balance chip restructured". Replace the
whole row:

```markdown
| F10 | ✅ **Mobile HUD density at ≤360px** — the header wrapped to three rows at 360px under worst-case load | Low | S | [029-release-polish](specs/029-release-polish/spec.md) | **DONE — and the pre-029 diagnosis in this row was wrong.** It claimed the `Goal 105·D20` caption was "the lever" and that the balance chip needed restructuring. Measured: de-tracking that caption saves **12px of the 13 needed** and still leaves three rows — a one-pixel trap that looks like a fix. The header went to **one** row (better than F10's two-row target) via three small removals instead: hide the decorative 🪙 below `sm` (−21px), withdraw the mobile lease chip (−61px, see **F7**), and move `Last Turn` into the gear menu (−99px). Final state 312 of 328px at 360px. 320px remains two rows, deliberately. |
```

- [ ] **Step 3: Note F7's partial reversal**

Append to the F7 row's Notes cell, before its closing ` |`:

```markdown
 **Mobile half withdrawn by [029](specs/029-release-polish/spec.md).** A device review of the live build found the compact form the width budget forced — `−15/d` — communicated nothing. The chip is now `hidden sm:flex`; mobile players read the nightly charge in the Day Summary, where it is itemised. The desktop readout is unchanged. Withdrawing it freed 61px of the 82px that got the mobile header onto one row.
```

- [ ] **Step 4: Fix F6's dangling spec number**

F6's note says "Deferred to **029**", which this spec now occupies. Reserving a number before
writing it is what caused the clash. Replace that phrase with:

```markdown
**Deferred by 028 to a future spec (number assigned when it is written, not reserved ahead).**
```

- [ ] **Step 5: Add the shipped row**

Insert after the F10 row:

```markdown
| F11 | ✅ **Release polish** — one-row mobile HUD, low-balance warning brought into the palette, `@` in the goal caption, SVG gear, bankruptcy season value on one line, parsnip favicon, recaptured screenshots, share-preview tags | Medium | M | [029-release-polish](specs/029-release-polish/spec.md) | **DONE.** Scoped from a device review of the live deploy, which is why several findings could not have surfaced in the preview browser. Closed the last two off-palette colours (`border-yellow-600/70`, `text-yellow-300` — class names, so 028's hex sweep and the contrast gate both missed them) and added a source-scanning test so they cannot come back. The gear became an inline SVG because its optical nudge had been measured in Chromium and read off-centre in iOS Safari — a class of bug that measuring harder in the preview cannot fix. |
```

- [ ] **Step 6: Sanity-check the table**

```bash
grep -c "^| F" backlog.md
```
Expected: one more than before (F11 added). Confirm no row lost its trailing `|`.

- [ ] **Step 7: Device check on the reporting device**

Open the deployed build (or the dev server over LAN) on the iOS device the findings came
from and confirm, by eye:
- the header is one row
- the gear is centred
- the low-balance border reads as a warning, not as a mismatched style
- the favicon is a parsnip in the tab

**§D and the favicon cannot be signed off from the preview browser.** Record the result.

- [ ] **Step 8: Commit**

```bash
git add backlog.md
git commit -m "docs(backlog): record 029, correct F10's diagnosis, note F7's reversal

F10's note claimed the balance caption was the lever; measurement showed
de-tracking it saves 12px of the 13 needed and still leaves three rows. The
one-pixel trap is now recorded so it is not retried."
```

---

## Definition of done

- [ ] `npm test && npm run lint && npm run build` green.
- [ ] `tests/theme/noOffPalette.test.ts` passes — no Tailwind default colour classes in `src/`.
- [ ] `grep -rn "vite.svg\|Screenshot[123]" .` (excluding `node_modules`/`.git`) returns nothing.
- [ ] Header measured at **one row, ~312 of 328px** at 360px, with the numbers written into
      the spec. 320px recorded as two rows.
- [ ] Every bankruptcy stat row is a single 40px line, checked with `3 Autumn Pressure`.
- [ ] `dist/index.html` carries absolute `og:`/`twitter:` URLs and `dist/og-image.png` exists.
- [ ] README images resolve from the repo root.
- [ ] Device check done on iOS Safari: one-row header, centred gear, warning reads as a
      warning, parsnip favicon in the tab.
- [ ] No engine, schema, analytics or simulator file modified. Confirm with
      `git diff --stat master...HEAD` — `src/` changes limited to `theme/palette.ts`,
      `components/HUD.tsx`, `components/GameMenu.tsx`, `components/GameMenuPopover.tsx` and
      `components/BankruptcyScreen.tsx`.
