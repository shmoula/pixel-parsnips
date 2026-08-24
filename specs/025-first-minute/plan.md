# 025 — First Minute (Presentation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set the expectation of failure in the game's first ten seconds, make the tax legible on every screen size, and lift the palette so the opening frame reads as a finished game.

**Architecture:** Three independent presentational changes, no engine involvement. Phase D is copy in two existing components. Phase B adds a HUD chip on desktop and one appended span on mobile, with a CSS-only pulse. Phase A extracts the repeated colour literals into a single `src/theme/palette.ts` consumed by `tailwind.config.ts`, adds a contrast test harness that goes red on three **pre-existing** violations, fixes those, and only then changes the values — so the visual change lands with a safety net already in place.

**Tech Stack:** TypeScript ~5.6, React 18.3, Tailwind CSS 3.4, Vite 5.4, Vitest + Testing Library (jsdom) + vitest-axe.

**Spec:** [spec.md](spec.md) · **Companion plan:** [plan-postmortem.md](plan-postmortem.md) covers Phase C (schema 11, run history, evidence line, death titles) and is independent of this one.

---

## Why this is two plans

The spec's four phases split cleanly along a risk line. D, B and A are **presentational** — no engine
file, no `GameState` field, no migration; the worst failure mode is that something looks wrong. C
adds a schema version, a migration branch and a new pure module; its worst failure mode is a
corrupted save. Different review needs, different blast radius, so they get separate plans and
separate branches. Run this one first: it is the one with a deadline attached in the marketing
calendar.

---

## Orientation

**Test commands.** `npm test` (full suite), `npx vitest run <file>`, `npx vitest run <file> -t "name"`.
Lint: `npm run lint`. Typecheck happens inside `npm run build` (`tsc -b`); there is no standalone script.

**jsdom reports every media query as `matches: false`** ([`tests/setup.ts`](../../tests/setup.ts)), so
components render their narrow-viewport branch by default. Tests that need desktop stub `matchMedia`
themselves — [`tests/components/ExpandableChip.test.tsx`](../../tests/components/ExpandableChip.test.tsx)
has the pattern to copy.

**Motion is CSS, not JS.** The codebase declares keyframes in `src/index.css` and gates them behind
`@media (prefers-reduced-motion: no-preference)` — see the `disaster-*` block at `index.css:41`. Copy
that pattern rather than reaching for `useReducedMotion()`; the media query suppresses the animation
for free and needs no test stub.

**vitest-axe cannot check colour contrast.** jsdom does not resolve Tailwind classes to computed
colours, so axe's `color-contrast` rule is silently skipped. That is why Task 6 builds a real
contrast harness — without it, "contrast is an acceptance criterion" is an unenforced sentence.

**Commit style.** Conventional Commits, matching the log (`feat(hud): …`, `fix(a11y): …`).

---

## Facts measured on the merged tree (2026-08-22)

These drove several decisions below; they are recorded so nobody re-measures them.

**Colour literal spread:** `#5C3D1E` 22× in 7 files · `#261808` 12× in 5 · `#3A2510` 6× in 5 ·
`#0E0A04` 2× in 2.

**The page background is not `farm-soil`.** `PageBackdrop.tsx:40` paints `bg-[#140E06]` behind
`soil_tile.webp`. `farm-soil` is modal and bankruptcy bodies. The spec's Phase A table was corrected
to match.

**Three contrast pairs already fail today, before any lift** (computed WCAG 2.1 ratios, alpha
composited against the real backgrounds):

| Pair | Today | After the proposed lift | Verdict |
|---|---|---|---|
| `text-farm-stone/50` lease text on the HUD bar | **2.02** | 2.03 | already failing; the lift is not the cause |
| `text-farm-stone` on `farm-soil` (CreditsModal) | **3.01** | 2.38 | already failing; the lift worsens it |
| `text-farm-stone` on `farm-ink` (stat rows) | **4.28** | 4.12 | already marginal; the lift worsens it |
| `#EB6A5C` critical balance on the chip | 5.55 | **4.90** | survives the lift — the spec's main worry is unfounded |
| `farm-gold` on the chip | 10.87 | 9.61 | fine |
| `farm-parchment/70` caption on the chip | 7.71 | 7.06 | fine |

**Chosen fixes, also measured:** dropping the lease text from `/50` to full-opacity `farm-stone`
gives **4.85** today and **4.53** on the lifted bar — clear of AA in both. Replacing label `text-farm-stone` with `text-farm-parchment/70`
gives **5.00** on the lifted soil and **7.61** on the lifted ink. Both clear 4.5:1.

---

## File structure

| File | Status | Responsibility |
|---|---|---|
| `src/components/OnboardingOverlay.tsx` | modify | Welcome-modal copy (Phase D). |
| `src/components/BankruptcyScreen.tsx` | modify | Failure echo above Restart (Phase D). |
| `src/components/HUD.tsx` | modify | Tax chip, mobile caption, lease-text a11y fix, token swap. |
| `src/components/GameBoard.tsx` | modify | Supplies the tax-pulse trigger to `HUD`. |
| `src/index.css` | modify | `tax-charged` keyframes, reduced-motion gated. |
| `src/theme/palette.ts` | **create** | Single source of truth for every farm colour, imported by the Tailwind config and by tests. |
| `tailwind.config.ts` | modify | Consumes `palette.ts` instead of inline hexes; gains the four chrome tokens. |
| `src/components/{BottomActionBar,BuildingCard,FarmEventModal,FarmGrid,GameMenu,GameMenuPopover,SeasonTransitionModal,Shop}.tsx` | modify | Mechanical literal → token swap (Task 5 only). |
| `src/components/CreditsModal.tsx` | modify | Label colour a11y fix. |
| `tests/helpers/contrast.ts` | **create** | WCAG 2.1 ratio with alpha compositing. |
| `tests/palette.contrast.test.ts` | **create** | The enforced pair list. |
| `tests/components/HUD.test.tsx` | modify | Tax chip, mobile caption. |
| `tests/components/OnboardingOverlay.test.tsx` | modify | Welcome copy. |
| `tests/components/BankruptcyScreen.test.tsx` | modify | Echo copy. |

---

## Task 1: The welcome-modal framing line

**Files:**
- Modify: `src/components/OnboardingOverlay.tsx` (welcome card, ~line 253)
- Modify: `tests/components/OnboardingOverlay.test.tsx`

**Context:** `70-DEEPDIVE.md` §4 calls this "the highest return-per-minute change in this entire
document". The current line ends in an exclamation mark, which reads cheery;
`11-BEACHHEAD.md` is explicit that cosy language attracts the wrong players and repels the
beachhead. The new middle line sets failure as the expected first outcome.

- [ ] **Step 1: Write the failing test**

Append to `tests/components/OnboardingOverlay.test.tsx`:

```tsx
describe('OnboardingOverlay — 025 failure framing', () => {
  it('tells the player up front that going broke is the expected first outcome', () => {
    render(
      <OnboardingOverlay
        step="welcome"
        harvestIncome={0}
        netIncome={0}
        onStart={() => {}}
        onSkip={() => {}}
        onDismissPayoff={() => {}}
      />,
    );
    expect(screen.getByText(/most people go broke the first time\. that's the game\./i)).toBeInTheDocument();
  });

  it('keeps the pitch but drops the cheery exclamation', () => {
    render(
      <OnboardingOverlay
        step="welcome"
        harvestIncome={0}
        netIncome={0}
        onStart={() => {}}
        onSkip={() => {}}
        onDismissPayoff={() => {}}
      />,
    );
    expect(screen.getByText(/grow crops\. sell 'em\. don't go broke\./i)).toBeInTheDocument();
    expect(screen.getByText(/let's fill your farm with radishes\./i)).toBeInTheDocument();
  });

  it('carries no exclamation mark anywhere on the welcome card', () => {
    const { container } = render(
      <OnboardingOverlay
        step="welcome"
        harvestIncome={0}
        netIncome={0}
        onStart={() => {}}
        onSkip={() => {}}
        onDismissPayoff={() => {}}
      />,
    );
    // 11-BEACHHEAD.md: cosy language attracts the wrong players and repels the beachhead.
    expect(container.textContent).not.toContain('!');
  });
});
```

If the file already has a render helper for the overlay, use it and pass `step="welcome"` rather
than repeating the prop list.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/OnboardingOverlay.test.tsx -t "025 failure framing"`
Expected: FAIL — `Unable to find an element with the text: /most people go broke…/`

- [ ] **Step 3: Rewrite the copy**

In `src/components/OnboardingOverlay.tsx`, replace the single `<p>` inside the `step === 'welcome'`
card with three:

```tsx
            <p className="font-pixel text-body text-farm-parchment leading-relaxed">
              Grow crops. Sell 'em. Don't go broke.
            </p>
            {/* 025 / 70-DEEPDIVE §4 — the expectation-setting line. The most common
                first experience is bankruptcy; saying so up front turns it from a
                complaint into the intended experience. */}
            <p className="font-pixel text-body text-farm-gold leading-relaxed">
              Most people go broke the first time. That's the game.
            </p>
            <p className="font-pixel text-caption text-farm-parchment/80 leading-relaxed">
              Let's fill your farm with radishes.
            </p>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/OnboardingOverlay.test.tsx`
Expected: PASS — including every pre-existing test in the file

- [ ] **Step 5: Commit**

```bash
git add src/components/OnboardingOverlay.tsx tests/components/OnboardingOverlay.test.tsx
git commit -m "feat(onboarding): say up front that going broke is the expected first run"
```

---

## Task 2: The bankruptcy echo

**Files:**
- Modify: `src/components/BankruptcyScreen.tsx` (button block, ~line 168)
- Modify: `tests/components/BankruptcyScreen.test.tsx`

**Context:** The other half of the same sentence. A confirmation, not a repeat — the welcome modal
made a prediction, and this is the game collecting on it. It sits directly above Restart, which
already provides the one-tap retry the deep-dive asks for.

This task is deliberately independent of the death titles in
[plan-postmortem.md](plan-postmortem.md); the echo works with or without them.

- [ ] **Step 1: Write the failing test**

Append to `tests/components/BankruptcyScreen.test.tsx`, reusing whatever props helper the file
already defines (the 024 pass added a full inline props literal you can copy if there is none):

```tsx
describe('BankruptcyScreen — 025 failure echo', () => {
  it('confirms the loss was expected, immediately above Restart', () => {
    renderScreen();
    const echo = screen.getByText(/told you\. again\?/i);
    expect(echo).toBeInTheDocument();

    const restart = screen.getByRole('button', { name: /restart game/i });
    // The echo is the setup and Restart is the punchline; they must read together.
    expect(echo.compareDocumentPosition(restart) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
```

Add a `renderScreen()` helper at the top of the file if one does not exist:

```tsx
function renderScreen(over: Partial<React.ComponentProps<typeof BankruptcyScreen>> = {}) {
  return render(
    <BankruptcyScreen
      daysPlayed={7}
      peakBalance={140}
      peakHarvestStreak={3}
      disastersSurvived={1}
      seasonReached={1}
      medal="none"
      records={{
        schemaVersion: 2,
        bestDaysSurvived: 7,
        bestPeakBalance: 140,
        bestSeasonReached: 1,
        mostDisastersSurvived: 1,
        bestHarvestStreak: 3,
        totalRunsCompleted: 2,
      }}
      newBests={new Set()}
      onRestart={() => {}}
      onReplayTutorial={() => {}}
      {...over}
    />,
  );
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/BankruptcyScreen.test.tsx -t "025 failure echo"`
Expected: FAIL — `Unable to find an element with the text: /told you\. again\?/i`

- [ ] **Step 3: Add the echo**

In `src/components/BankruptcyScreen.tsx`, insert immediately before the
`<div className="flex flex-col gap-2 w-full max-w-xs mt-2">` that wraps the buttons:

```tsx
      {/* 025 — the other end of the welcome modal's promise. A confirmation that
          this was the intended first experience, not a consolation. */}
      <p className="font-pixel text-body text-farm-gold">Told you. Again?</p>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/BankruptcyScreen.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/BankruptcyScreen.tsx tests/components/BankruptcyScreen.test.tsx
git commit -m "feat(ui): echo the failure framing on the bankruptcy screen"
```

---

## Task 3: The tax chip on desktop

> **Reverted (Phase B).** This task was implemented and then pulled — the constant rate added a
> permanent HUD element without new information over the day-end summary. Kept as the record of what
> was built; the tax chip is not in the shipped HUD. See the spec's **Delivery status**.

**Files:**
- Modify: `src/components/HUD.tsx`
- Modify: `src/components/GameBoard.tsx`
- Modify: `src/index.css`
- Modify: `tests/components/HUD.test.tsx`

**Context:** Today `Tax 6%` renders at `text-farm-stone/50` inside the right-hand chrome cluster,
`hidden sm:flex`, far from the balance it attacks. The spec promotes it to a real chip **immediately
right of the balance chip**, because adjacency carries the causality with no copy. The content stays
the **rate**, not the charged amount — a preview computed from the current balance would be too low
whenever a harvest is about to land, and a dread indicator must not err in the reassuring direction.

The pulse is triggered by remounting the chip with a `key` that changes when a new day's tax is
charged. That restarts the CSS animation with no timers and no `useReducedMotion()` — the
`prefers-reduced-motion` media query in `index.css` suppresses it.

- [ ] **Step 1: Write the failing test**

Append to `tests/components/HUD.test.tsx`. Add `taxChargedOnDay: null` to the shared `baseProps`
object first.

```tsx
describe('HUD — 025 tax chip', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubDesktop() {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(min-width: 640px)',
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }));
  }

  it('renders the rate as a chip with an explanatory accessible name', () => {
    stubDesktop();
    render(<HUD {...baseProps} currentDay={1} coinBalance={100} />);
    const chip = screen.getByLabelText(/tax: 6% of your coins is taken every night/i);
    expect(chip).toHaveTextContent(/TAX 6%/i);
  });

  it('shows no charged amount and no forward preview', () => {
    stubDesktop();
    render(<HUD {...baseProps} currentDay={4} coinBalance={200} taxChargedOnDay={3} />);
    const chip = screen.getByLabelText(/tax: 6%/i);
    expect(chip.textContent).not.toMatch(/[−-]\d/);
    expect(chip.textContent).not.toMatch(/tomorrow/i);
  });

  it('drops the old dim Tax span from the chrome cluster', () => {
    stubDesktop();
    const { container } = render(<HUD {...baseProps} currentDay={1} coinBalance={100} />);
    const dim = Array.from(container.querySelectorAll('.text-farm-stone\\/50'));
    expect(dim.some(el => /tax/i.test(el.textContent ?? ''))).toBe(false);
  });

  it('keeps the lease readout, including the end-of-season preview', () => {
    stubDesktop();
    render(<HUD {...baseProps} currentDay={20} coinBalance={300} />);
    expect(screen.getByText(/lease/i)).toBeInTheDocument();
    expect(screen.getByText(/rises to \d+ next season/i)).toBeInTheDocument();
  });

  it('carries the pulse class only once a tax has actually been charged', () => {
    stubDesktop();
    const { rerender } = render(<HUD {...baseProps} currentDay={1} coinBalance={100} taxChargedOnDay={null} />);
    expect(screen.getByLabelText(/tax: 6%/i).className).not.toContain('tax-charged-anim');

    rerender(<HUD {...baseProps} currentDay={2} coinBalance={120} taxChargedOnDay={1} />);
    expect(screen.getByLabelText(/tax: 6%/i).className).toContain('tax-charged-anim');
  });

  it('remounts the chip on each new charge so the animation replays', () => {
    stubDesktop();
    const { rerender } = render(<HUD {...baseProps} currentDay={2} coinBalance={120} taxChargedOnDay={1} />);
    const first = screen.getByLabelText(/tax: 6%/i);
    rerender(<HUD {...baseProps} currentDay={3} coinBalance={140} taxChargedOnDay={2} />);
    // A changed key produces a different element instance, which restarts the CSS animation.
    expect(screen.getByLabelText(/tax: 6%/i)).not.toBe(first);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/HUD.test.tsx -t "025 tax chip"`
Expected: FAIL — `Unable to find a label with the text of: /tax: 6% of your coins…/`

- [ ] **Step 3: Add the keyframes**

Append to `src/index.css`, after the existing `disaster-*` block:

```css
/* 025 — the nightly tax charge. One shot, restarted by remounting the chip with a
   new key. Gated on prefers-reduced-motion like every other animation here, which
   is why the component applies the class unconditionally. */
@keyframes tax-charged {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 rgba(245, 200, 66, 0);
  }
  35% {
    transform: scale(1.08);
    box-shadow: 0 0 14px rgba(245, 200, 66, 0.55);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 rgba(245, 200, 66, 0);
  }
}

@media (prefers-reduced-motion: no-preference) {
  .tax-charged-anim {
    animation: tax-charged 0.6s ease-out;
  }
}
```

- [ ] **Step 4: Add the chip to `HUD.tsx`**

Add to `HUDProps`, after `contract`:

```tsx
  /** 025 — the day whose tax charge should pulse the tax chip, or null before any
   *  night has been charged. Used only as an animation key; the chip always shows
   *  the rate, never the amount. */
  taxChargedOnDay: number | null;
```

Add `taxChargedOnDay,` to the destructured parameter list.

Add this component above `HUD`, beside `ContractChip`:

```tsx
/** 025 — the nightly tax, promoted from dim chrome text to a chip beside the balance.
 *  Shows the RATE, deliberately: the charge is computed after lease and after harvest
 *  income lands (gameEngine.ts:605), so any figure derived from the current balance
 *  would understate the bite — the one direction a dread indicator must not err in.
 *  The real number is itemised in the Day Summary. */
function TaxChip({ chargedOnDay }: { chargedOnDay: number | null }) {
  return (
    <div
      // Remounting on a new charge restarts the one-shot CSS animation.
      key={chargedOnDay ?? 'none'}
      aria-label={`Tax: ${TAX_RATE * 100}% of your coins is taken every night.`}
      className={`
        flex items-center gap-1 bg-[#261808] px-2.5 py-1 rounded border border-[#5C3D1E]/60
        ${chargedOnDay === null ? '' : 'tax-charged-anim'}
      `}
    >
      <EmojiIcon className="text-base leading-none">📉</EmojiIcon>
      <span className="font-pixel text-caption text-farm-gold uppercase tracking-widest">
        Tax {TAX_RATE * 100}%
      </span>
    </div>
  );
}
```

Render it immediately after the balance chip's closing `</div>` and before the
`{harvestStreak > 0 && (` block:

```tsx
        <div className="hidden sm:block">
          <TaxChip chargedOnDay={taxChargedOnDay} />
        </div>
```

Delete the old dim tax span from the right-hand cluster — the whole element:

```tsx
          <span className="font-pixel text-caption text-farm-stone/50 uppercase tracking-widest">
            Tax {TAX_RATE * 100}%
          </span>
```

Leave the Lease span exactly as it is, including its `rises to N next season` preview.

- [ ] **Step 5: Supply the trigger from `GameBoard.tsx`**

Add to the `<HUD …>` element, after `contract={contractChip}`:

```tsx
        taxChargedOnDay={lastDailyLog && lastDailyLog.taxDeducted > 0 ? lastDailyLog.day : null}
```

`lastDailyLog` is already in scope in `GameBoard` — it is the same value fed to `hasLastTurn`.

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/components/HUD.test.tsx`
Expected: PASS — the six new tests and every pre-existing one

- [ ] **Step 7: Run the full suite, lint and build**

Run: `npm test && npm run lint && npm run build`
Expected: all green. If a `GameBoard` test fails to typecheck on the new required `taxChargedOnDay`
prop, that render call needs `taxChargedOnDay={null}`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(hud): promote the nightly tax to a chip beside the balance"
```

---

## Task 4: The tax on mobile

> **Reverted (Phase B).** Pulled together with Task 3 — no tax caption ships in the mobile balance
> chip. Kept as the record of the trialed design. See the spec's **Delivery status**.

**Files:**
- Modify: `src/components/HUD.tsx` (balance chip caption, ~line 189)
- Modify: `tests/components/HUD.test.tsx`

**Context:** Below 640px the whole Lease/Tax cluster is `hidden`, so a phone player's only encounter
with the tax today is the Day 1 Summary at ~60 seconds — the ambush §3.2 calls backwards. The mobile
HUD already carries four-plus chips at 375px, so this appends to the balance chip's **existing**
caption rather than adding a sixth: no new chip, no new row, no wrap risk. Ordering is
`goal · tax · warning`, with the late-season warning still last.

- [ ] **Step 1: Write the failing test**

Append to `tests/components/HUD.test.tsx`:

```tsx
describe('HUD — 025 tax on mobile', () => {
  // The default jsdom matchMedia stub reports every query as false, i.e. narrow.
  it('appends the rate to the balance caption instead of adding a chip', () => {
    render(<HUD {...baseProps} currentDay={1} coinBalance={100} />);
    const caption = screen.getByText(/goal 105·D20/i);
    expect(caption.parentElement).toHaveTextContent(/tax 6%/i);
  });

  it('keeps the late-season warning after the tax', () => {
    render(<HUD {...baseProps} currentDay={18} coinBalance={50} />);
    const caption = screen.getByText(/goal 105·D20/i).parentElement!;
    const text = caption.textContent ?? '';
    expect(text.indexOf('Tax')).toBeGreaterThan(text.indexOf('Goal'));
    expect(text.indexOf('days left')).toBeGreaterThan(text.indexOf('Tax'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/HUD.test.tsx -t "025 tax on mobile"`
Expected: FAIL — the caption's parent has no `Tax 6%` text

- [ ] **Step 3: Append the rate to the caption**

In `src/components/HUD.tsx`, inside the balance chip's caption `<span>`, insert between the two
goal spans and the `showWarning` block:

```tsx
              {/* 025 — the mobile tax surface. The chip form is desktop-only; on a
                  375px header a sixth chip wraps the row, so the rate rides along
                  with the number it attacks. */}
              <span className="sm:hidden"> · Tax {TAX_RATE * 100}%</span>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/HUD.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/HUD.tsx tests/components/HUD.test.tsx
git commit -m "feat(hud): surface the tax rate on mobile via the balance caption"
```

---

## Task 5: Extract the palette into one module

**Files:**
- Create: `src/theme/palette.ts`
- Modify: `tailwind.config.ts`
- Modify: `src/components/{HUD,GameMenu,GameMenuPopover,BottomActionBar,BuildingCard,FarmEventModal,FarmGrid,SeasonTransitionModal,Shop}.tsx`
- Modify: `src/components/PageBackdrop.tsx`

**Context:** Pure refactor — **no value changes, no visual diff.** The four chrome literals are
repeated 42 times across nine files; tuning them in place would mean a nine-file sweep per
adjustment, and the author has said the lift needs visual iteration. Doing the extraction as its own
commit also means the next commit's diff is *only* the colour change, which is exactly what wants
reviewing.

- [ ] **Step 1: Create the palette module**

Create `src/theme/palette.ts`:

```ts
/**
 * 025 — every colour the game paints, in one place.
 *
 * Imported by tailwind.config.ts (so the tokens derive from here, not the other
 * way round) and by tests/palette.contrast.test.ts (so a contrast assertion reads
 * the same value the UI ships). Change a value here and both follow.
 */
export const PALETTE = {
  soil: '#4A2F1A',
  grass: '#357028',
  sky: '#6BBFFF',
  gold: '#F5C842',
  red: '#C0392B',
  stone: '#8C7B6B',
  parchment: '#F5ECD7',
  ink: '#1A1A1A',

  /** HUD header bar. */
  bar: '#0E0A04',
  /** HUD chip and menu-row body. */
  chip: '#261808',
  /** Chip and panel border. */
  chipBorder: '#5C3D1E',
  /** Chip and row hover. */
  chipHover: '#3A2510',
  /** Flat colour behind the tiled soil texture on PageBackdrop. */
  page: '#140E06',
  /** Critical-balance red, kept readable on `chip` (see the contrast test). */
  danger: '#EB6A5C',
} as const;
```

- [ ] **Step 2: Point the Tailwind config at it**

Replace the `colors` block in `tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss';
import { PALETTE } from './src/theme/palette';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        farm: {
          soil: PALETTE.soil,
          grass: PALETTE.grass,
          sky: PALETTE.sky,
          gold: PALETTE.gold,
          red: PALETTE.red,
          stone: PALETTE.stone,
          parchment: PALETTE.parchment,
          ink: PALETTE.ink,
          bar: PALETTE.bar,
          chip: PALETTE.chip,
          chipBorder: PALETTE.chipBorder,
          chipHover: PALETTE.chipHover,
          page: PALETTE.page,
          danger: PALETTE.danger,
        },
      },
      // fontFamily and fontSize blocks are unchanged — leave them exactly as they are.
```

- [ ] **Step 3: Swap the literals for tokens**

Mechanical find-and-replace across `src/`. Run each and check the count matches the expected figure
from the measurement table above:

```bash
grep -rl '#261808' src/ | xargs sed -i '' 's/bg-\[#261808\]/bg-farm-chip/g'
grep -rl '#5C3D1E' src/ | xargs sed -i '' 's/\[#5C3D1E\]/farm-chipBorder/g'
grep -rl '#3A2510' src/ | xargs sed -i '' 's/\[#3A2510\]/farm-chipHover/g'
grep -rl '#0E0A04' src/ | xargs sed -i '' 's/\[#0E0A04\]/farm-bar/g'
grep -rl '#140E06' src/ | xargs sed -i '' 's/bg-\[#140E06\]/bg-farm-page/g'
grep -rl '#EB6A5C' src/ | xargs sed -i '' 's/text-\[#EB6A5C\]/text-farm-danger/g'
```

Note the `[#5C3D1E]` rule is written without a `border-` prefix on purpose — that literal appears as
`border-[#5C3D1E]`, `border-[#5C3D1E]/60`, `border-[#5C3D1E]/50` and inside `hover:` variants, and
stripping only the bracket form handles all of them.

- [ ] **Step 4: Confirm nothing was missed and nothing changed value**

```bash
grep -rn '#261808\|#5C3D1E\|#3A2510\|#0E0A04\|#140E06\|#EB6A5C' src/
```

Expected: **only** `src/theme/palette.ts`. `#4A2F1A` in `Shop.tsx` is an awning stripe, not a
background — leave it.

- [ ] **Step 5: Verify the refactor is visually inert**

Run: `npm test && npm run lint && npm run build`
Expected: all green. Any test asserting a literal class name (for example the
`text-[#5FB54A]` check in `HUD.test.tsx`) still passes, because those colours were not touched.

Then start the dev server and compare against `git stash` — the rendered page must be
**pixel-identical**. This is the only checkpoint where "no visible change" is the success criterion.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(theme): centralise the palette in src/theme/palette.ts"
```

---

## Task 6: A contrast harness, and the three pairs that already fail

**Files:**
- Create: `tests/helpers/contrast.ts`
- Create: `tests/palette.contrast.test.ts`
- Modify: `src/components/HUD.tsx` (lease readout)
- Modify: `src/components/CreditsModal.tsx` (section headings, footer line)
- Modify: `src/components/BankruptcyScreen.tsx` (stat-row labels, section headings)

**Context:** The spec makes contrast an acceptance criterion, and vitest-axe cannot deliver it —
jsdom never resolves a Tailwind class to a computed colour, so axe's `color-contrast` rule is
silently skipped across the whole suite. Without a real harness the criterion is decorative.

**The list must mirror what the components actually render, not what we wish they rendered.** A pair
list written with the *fixed* foregrounds passes on day one and proves nothing; the rows below
encode today's shipped combinations, which is why three of them are red before a single colour
moves. Updating a row is only legitimate in the same commit that changes the component it mirrors.

All three failures are **pre-existing** — the lift did not cause them, and would deepen two.

- [ ] **Step 1: Write the ratio helper**

Create `tests/helpers/contrast.ts`:

```ts
/** WCAG 2.1 relative luminance and contrast ratio, with alpha compositing. */

type Rgb = readonly [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ] as const;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Flattens a translucent foreground onto an opaque background. Tailwind's `/50`
 *  suffixes are alpha, and an un-composited ratio is meaninglessly optimistic. */
export function composite(fg: string, alpha: number, bg: string): Rgb {
  const f = hexToRgb(fg);
  const b = hexToRgb(bg);
  return [0, 1, 2].map(i => Math.round(f[i] * alpha + b[i] * (1 - alpha))) as unknown as Rgb;
}

/** Contrast ratio of an (optionally translucent) foreground over a background. */
export function contrastRatio(fg: string, bg: string, alpha = 1): number {
  const a = luminance(composite(fg, alpha, bg));
  const b = luminance(hexToRgb(bg));
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}
```

- [ ] **Step 2: Write the pair list, mirroring today's components**

Create `tests/palette.contrast.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PALETTE } from '../src/theme/palette';
import { contrastRatio } from './helpers/contrast';

/** WCAG AA for normal-size text. Every pair below is body or caption text. */
const AA = 4.5;

/**
 * 025 — the enforced contrast pairs.
 *
 * vitest-axe cannot check these: jsdom never resolves a Tailwind class to a computed
 * colour, so axe's color-contrast rule is silently skipped. This list is the real gate.
 *
 * Each row MIRRORS a combination a component actually renders — `where` names it. A row
 * may only change in the same commit that changes the component it mirrors; editing a row
 * to make a test pass, without touching the UI, defeats the entire point of the file.
 */
const PAIRS: ReadonlyArray<{ name: string; where: string; fg: string; bg: string; alpha?: number }> = [
  { name: 'critical balance',   where: 'HUD.tsx balance chip',       fg: PALETTE.danger,    bg: PALETTE.chip },
  { name: 'gold value',         where: 'HUD.tsx chips',              fg: PALETTE.gold,      bg: PALETTE.chip },
  { name: 'caption',            where: 'HUD.tsx chip captions',      fg: PALETTE.parchment, bg: PALETTE.chip, alpha: 0.7 },
  { name: 'menu row label',     where: 'GameMenuPopover.tsx rows',   fg: PALETTE.parchment, bg: PALETTE.chip, alpha: 0.9 },
  { name: 'lease readout',      where: 'HUD.tsx lease span',         fg: PALETTE.stone,     bg: PALETTE.bar,  alpha: 0.5 },
  { name: 'modal body',         where: 'CreditsModal.tsx paragraphs',fg: PALETTE.parchment, bg: PALETTE.soil },
  { name: 'modal heading',      where: 'CreditsModal.tsx h2',        fg: PALETTE.gold,      bg: PALETTE.soil },
  { name: 'section label',      where: 'CreditsModal.tsx h3',        fg: PALETTE.stone,     bg: PALETTE.soil },
  { name: 'stat-row label',     where: 'BankruptcyScreen.tsx StatRow',fg: PALETTE.stone,    bg: PALETTE.ink },
  { name: 'stat-row value',     where: 'BankruptcyScreen.tsx StatRow',fg: PALETTE.gold,     bg: PALETTE.ink },
];

describe('palette contrast (WCAG AA, normal text)', () => {
  it.each(PAIRS)('$name ($where) clears 4.5:1', ({ fg, bg, alpha }) => {
    expect(contrastRatio(fg, bg, alpha ?? 1)).toBeGreaterThanOrEqual(AA);
  });
});

describe('contrast helper', () => {
  it('matches known reference ratios', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
    expect(contrastRatio('#000000', '#000000')).toBeCloseTo(1, 5);
  });
});
```

- [ ] **Step 3: Run and confirm exactly three reds**

Run: `npx vitest run tests/palette.contrast.test.ts`
Expected: **FAIL on exactly three pairs**, at these ratios:

| Pair | Measured | Target |
|---|---|---|
| `lease readout (HUD.tsx lease span)` | **2.02** | 4.5 |
| `section label (CreditsModal.tsx h3)` | **3.01** | 4.5 |
| `stat-row label (BankruptcyScreen.tsx StatRow)` | **4.28** | 4.5 |

The other seven pass. If the count or the ratios differ, stop and reconcile — a surprise means a
colour moved since this plan was measured, and the rest of the numbers below are then suspect.

- [ ] **Step 4: Fix the lease readout**

In `src/components/HUD.tsx` the lease span reads `text-farm-stone/50 uppercase tracking-widest`.
Drop the opacity:

```tsx
          <span className="font-pixel text-caption text-farm-stone uppercase tracking-widest">
```

Full-opacity `farm-stone` on the bar measures **4.85** today and **4.53** after the lift. No new
colour is needed — the `/50` was the entire problem.

Update the matching row to mirror it:

```ts
  { name: 'lease readout',      where: 'HUD.tsx lease span',         fg: PALETTE.stone,     bg: PALETTE.bar },
```

- [ ] **Step 5: Fix the `farm-stone`-on-`farm-soil` labels**

In `src/components/CreditsModal.tsx`, replace **both** `text-farm-stone` occurrences — the `Section`
heading and the "Game code © 2026 …" paragraph — with `text-farm-parchment/70`. Measures **5.98**
today and **5.00** after the lift.

Update the row:

```ts
  { name: 'section label',      where: 'CreditsModal.tsx h3',        fg: PALETTE.parchment, bg: PALETTE.soil, alpha: 0.7 },
```

- [ ] **Step 6: Fix the `farm-stone`-on-`farm-ink` labels**

In `src/components/BankruptcyScreen.tsx`, replace `text-farm-stone` with `text-farm-parchment/70`
in three places: `StatRow`'s label span, the "Personal Records" heading, and the "Insight" heading.
Measures **7.78** today and **7.61** after the lift.

Update the row:

```ts
  { name: 'stat-row label',     where: 'BankruptcyScreen.tsx StatRow',fg: PALETTE.parchment, bg: PALETTE.ink, alpha: 0.7 },
```

- [ ] **Step 7: Run to verify all ten pass**

Run: `npx vitest run tests/palette.contrast.test.ts`
Expected: PASS — 10 pairs, 0 skipped

- [ ] **Step 8: Run the full suite and lint**

Run: `npm test && npm run lint`
Expected: green. A component test asserting the literal class `text-farm-stone` on one of the three
changed elements will fail — update it to the new class; the assertion is still valid, the colour
moved.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "fix(a11y): raise three sub-4.5:1 text pairs to AA, gated by a contrast harness"
```

---

## Task 7: Lift the palette

**Files:**
- Modify: `src/theme/palette.ts`

**Context:** The whole reason for Tasks 5–7. One file, seven values, with the contrast harness as the
gate. `70-DEEPDIVE.md` §3.3 is the argument: near-black browns fill the viewport, and as a first
impression — and as a thumbnail in a feed of bright listings — that reads as unfinished or broken.

**These values are a direction, not a result.** The author reviews screenshots before this merges.

- [ ] **Step 1: Change the seven values**

In `src/theme/palette.ts`:

```ts
  soil: '#5E3D22',       // was #4A2F1A
  ink: '#241C14',        // was #1A1A1A — also warms a flat neutral
  bar: '#1C1208',        // was #0E0A04
  chip: '#33220E',       // was #261808
  chipBorder: '#7A5228', // was #5C3D1E
  chipHover: '#4A3016',  // was #3A2510
  page: '#241806',       // was #140E06
```

`grass`, `sky`, `gold`, `red`, `stone`, `parchment` and `danger` are foregrounds — leave them.

- [ ] **Step 2: Run the contrast gate**

Run: `npx vitest run tests/palette.contrast.test.ts`
Expected: PASS, all 10. The tightest pair is `critical balance on chip` at **4.90** (down from 5.55
but clear of 4.5). If a pair drops under, the fix is the *foreground*, not abandoning the lift.

- [ ] **Step 3: Run the full suite**

Run: `npm test && npm run lint && npm run build`
Expected: all green

- [ ] **Step 4: Review the visual result**

Start the dev server and capture before/after on: the day-1 board, the shop open, a mid-run board
with crops, and the bankruptcy screen. **This is the merge gate for the whole plan** — the values
above are a starting point and are expected to need a round or two of adjustment. Adjusting means
editing `src/theme/palette.ts` and re-running Step 2; nothing else moves.

- [ ] **Step 5: Handle `soil_tile.webp`**

The dominant dark area is the tiled backdrop image, which no token reaches. The author supplies a
brightened `src/assets/decor/soil_tile.webp`. **This task does not block on it**: the file is
auto-discovered by `decorAssets.ts` via `import.meta.glob`, and until it lands the backdrop falls
back to the lifted `farm-page` colour, which is coherent on its own. Drop the new file in when it
arrives — no code change.

- [ ] **Step 6: Commit**

```bash
git add src/theme/palette.ts
git commit -m "feat(theme): lift the palette out of near-black"
```

---

## Task 8: Regenerate the marketing screenshots

**Files:**
- Create: five image exports (destination per `50-C17-ASSETS.md`)

**Context:** `50-C17-ASSETS.md` names five required assets and currently prescribes a manual
"brighten every asset in Preview" step. If the lift worked, that step is now unnecessary — which is
the cheapest possible confirmation that Task 8 went far enough.

`ux-audit-screenshots/` is explicitly **out of scope**: it is a dated record of the 016 audit, not a
living fixture.

- [ ] **Step 1: Capture the five named assets from the lifted build**

Against the dev server, produce: `bankruptcy.png`, `mobile-375.png` (at a 375px viewport),
`planted-grid.png`, `next-day.gif`, `cover-630x500.png`.

- [ ] **Step 2: Check the manual brighten step is now redundant**

Open each in Preview and inspect the darkest region. It should read as **dark brown**, not black,
with no exposure adjustment applied. If any still needs raising, the lift did not go far enough —
return to Task 7 Step 1 rather than brightening the export.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs(assets): regenerate marketing screenshots from the lifted palette"
```

---

## Final verification

- [ ] **Run everything**

```bash
npm test && npm run lint && npm run build
```

- [ ] **Confirm this plan stayed out of the engine**

```bash
git diff --stat master -- src/engine
```

Expected: **no output.** Phases D, B and A touch no engine file, no `GameState` field and no
`SCHEMA_VERSION`. Anything here means work from [plan-postmortem.md](plan-postmortem.md) has leaked
into this branch.

- [ ] **Manual smoke check**

1. Load a fresh game (clear localStorage): the welcome modal shows three lines, the middle one in
   gold, and no exclamation mark.
2. At desktop width, a `TAX 6%` chip sits immediately right of the coin balance.
3. Press Next Day: the tax chip pulses once as the day resolves.
4. With OS "reduce motion" enabled, it does not pulse.
5. At 375px, the balance chip caption reads `Goal 105·D20 · Tax 6%` on one line, and the header does
   not wrap to three rows.
6. On day 18 at a low balance, the caption reads goal, then tax, then the red days-left warning.
7. Go bankrupt: "Told you. Again?" sits directly above Restart.
8. Nothing anywhere reads as near-black.
