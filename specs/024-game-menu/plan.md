# 024 — Game Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate every non-gameplay control into one gear menu in the HUD, add an in-product asset-attribution screen and a mid-run restart, and stop two HUD chips showing a pointer cursor for a no-op.

**Architecture:** Three new presentational components — `ExpandableChip` (breakpoint-aware chip element), `GameMenu` (gear button + popover + rows), `CreditsModal` — plus prop threading from `App` → `GameBoard` → `HUD` → `GameMenu` for the two run-resetting actions. The two floating controls (`MuteToggle`, `AnalyticsOptOutToggle`) are deleted and their logic absorbed into menu rows; their behavioural tests are rewritten against the new address rather than dropped. No engine changes, no `GameState` fields, no `SCHEMA_VERSION` bump.

**Tech Stack:** TypeScript ~5.6, React 18.3, Tailwind CSS 3.4, Vite 5.4, Vitest + Testing Library (jsdom) + vitest-axe.

**Spec:** [spec.md](spec.md)

---

## Orientation for someone new to this codebase

Read this once before Task 1; it will save you from three avoidable mistakes.

**Test commands.** `npm test` runs the whole suite once (`vitest run`). A single file is
`npx vitest run tests/components/HUD.test.tsx`. A single test is
`npx vitest run tests/components/HUD.test.tsx -t "name fragment"`. Lint is `npm run lint`.
There is no separate typecheck script — `npm run build` runs `tsc -b` first.

**jsdom defaults to "mobile".** [`tests/setup.ts`](../../tests/setup.ts) installs a `matchMedia`
stub that returns `matches: false` for **every** query. `useMediaQuery('(min-width: 640px)')`
therefore returns `false` by default, so components under test render their **narrow-viewport**
branch unless a test explicitly stubs otherwise. This is why every existing HUD chip test keeps
passing after Task 1 — and why the desktop assertions in Task 1 must stub `matchMedia` themselves.

**Tailwind Preflight styles every `<button>` with `cursor: pointer`.** That is the entire bug in
Task 1. There is no stray CSS rule to hunt for; the fix is to stop rendering a `<button>` where
nothing happens.

**Emoji need `EmojiIcon`.** [`src/components/EmojiIcon.tsx`](../../src/components/EmojiIcon.tsx)
applies a measured optical lift so emoji line up with Press Start 2P. Use it for any decorative
emoji; it already sets `aria-hidden`.

**Two ARIA roles for menu rows.** Action rows are `role="menuitem"`. Toggle rows are
`role="menuitemcheckbox"` with `aria-checked` — `aria-pressed` on a `menuitem` is invalid ARIA and
vitest-axe will fail it. Code that queries "any row" uses the attribute-prefix selector
`[role^="menuitem"]`, which matches both.

**Commit style.** Conventional Commits, matching the existing log (`feat(shop): …`, `fix(hud): …`).

---

## File structure

| File | Status | Responsibility |
|---|---|---|
| `src/components/ExpandableChip.tsx` | **create** | Renders a HUD chip as `<button>` below `sm` and `<div>` at `sm`+. Nothing else. |
| `src/components/GameMenu.tsx` | **create** | Gear trigger, popover shell (open/close/Escape/outside-click/focus), the five rows, and the two local row primitives. Owns the credits-modal open state. |
| `src/components/CreditsModal.tsx` | **create** | The attribution dialog. Pure content + Escape/Close. |
| `src/components/HUD.tsx` | modify | Uses `ExpandableChip` for the Day and Reputation chips; renders `GameMenu` where `MuteToggle` was; gains two props. |
| `src/components/GameBoard.tsx` | modify | Threads `onReplayTutorial` through to `HUD`. |
| `src/App.tsx` | modify | Defines the shared replay-tutorial handler; stops rendering `AnalyticsOptOutToggle`. |
| `src/analytics/events.ts` | modify | Adds the `credits_viewed` event. |
| `src/components/MuteToggle.tsx` | **delete** | Sole caller becomes the Sound row. |
| `src/components/AnalyticsOptOutToggle.tsx` | **delete** | Sole caller becomes the Analytics row. |
| `LICENSE`, `README.md` | modify | Asset licence carve-out. |
| `tests/components/ExpandableChip.test.tsx` | **create** | Breakpoint behaviour in isolation. |
| `tests/components/GameMenu.test.tsx` | **create** | Popover a11y + all five rows, including the behaviour migrated from the two deleted components' tests. |
| `tests/components/CreditsModal.test.tsx` | **create** | Attribution content + dialog behaviour. |
| `tests/components/HUD.test.tsx` | modify | Adds desktop-cursor assertions and a gear-presence assertion. |
| `tests/analytics/events.test.ts` | modify | Covers `credits_viewed`. |
| `tests/components/MuteToggle.test.tsx` | **delete** | Behaviour migrated to `GameMenu.test.tsx` in Task 8. |
| `tests/components/AnalyticsOptOutToggle.test.tsx` | **delete** | Behaviour migrated to `GameMenu.test.tsx` in Task 5. |

**Task order rationale:** Task 1 (cursor fix) is independent and lands first. Tasks 2–7 build the
new components in isolation, so the suite stays green throughout. Tasks 8–9 wire them in and delete
the old ones — the only steps that can break existing tests. Task 10 is documentation.

---

## Task 1: Breakpoint-aware HUD chip (the cursor fix)

**Files:**
- Create: `src/components/ExpandableChip.tsx`
- Create: `tests/components/ExpandableChip.test.tsx`
- Modify: `src/components/HUD.tsx` (Day chip ~line 161, Reputation chip ~line 213)
- Modify: `tests/components/HUD.test.tsx`

**Context:** The Day and Reputation chips are `<button>`s whose `onClick` toggles a piece of state
that only feeds `sm:hidden` / `hidden sm:inline` classes. At ≥640px the full labels always render,
so the click does nothing while Preflight still paints a pointer cursor. Below 640px the toggle is
how `D1/20` expands to `Season 1 · Spring Thaw`, so it must be preserved.

- [ ] **Step 1: Write the failing test**

Create `tests/components/ExpandableChip.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExpandableChip } from '../../src/components/ExpandableChip';

/** Stub matchMedia so `(min-width: 640px)` reports `matches`. */
function stubViewport(isDesktop: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: isDesktop && query === '(min-width: 640px)',
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

beforeEach(() => stubViewport(false));
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe('ExpandableChip', () => {
  it('renders a button that toggles below the sm breakpoint', async () => {
    const onToggle = vi.fn();
    render(
      <ExpandableChip expanded={false} onToggle={onToggle} className="chip" ariaLabel="Reputation: Farmer">
        <span>Farmer</span>
      </ExpandableChip>,
    );
    const chip = screen.getByRole('button', { name: /reputation: farmer/i });
    expect(chip).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(chip);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders a non-interactive element at sm and up', () => {
    stubViewport(true);
    const onToggle = vi.fn();
    render(
      <ExpandableChip expanded={false} onToggle={onToggle} className="chip" ariaLabel="Reputation: Farmer">
        <span>Farmer</span>
      </ExpandableChip>,
    );
    // No button means no Preflight `cursor: pointer` and no dead click target.
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Farmer')).toBeInTheDocument();
  });

  it('drops aria-expanded at sm and up', () => {
    stubViewport(true);
    const { container } = render(
      <ExpandableChip expanded onToggle={() => {}} className="chip">
        <span>Spring</span>
      </ExpandableChip>,
    );
    expect(container.querySelector('[aria-expanded]')).toBeNull();
  });

  it('keeps the className in both modes', () => {
    const { container, unmount } = render(
      <ExpandableChip expanded={false} onToggle={() => {}} className="chip-x">
        <span>A</span>
      </ExpandableChip>,
    );
    expect(container.querySelector('.chip-x')).toBeInTheDocument();
    unmount();

    stubViewport(true);
    const second = render(
      <ExpandableChip expanded={false} onToggle={() => {}} className="chip-x">
        <span>A</span>
      </ExpandableChip>,
    );
    expect(second.container.querySelector('.chip-x')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/ExpandableChip.test.tsx`
Expected: FAIL — `Failed to resolve import "../../src/components/ExpandableChip"`

- [ ] **Step 3: Write the implementation**

Create `src/components/ExpandableChip.tsx`:

```tsx
import type { ReactNode } from 'react';
import { useMediaQuery } from '../hooks/useMediaQuery';

/** Tailwind's `sm` breakpoint. Kept in step with the `sm:` variants in HUD.tsx. */
export const SM_QUERY = '(min-width: 640px)';

interface ExpandableChipProps {
  /** Current expanded state; only meaningful below `sm`. */
  expanded: boolean;
  onToggle: () => void;
  className: string;
  children: ReactNode;
  /** Native tooltip, applied in both modes. */
  title?: string;
  /** Accessible name for the interactive (narrow) mode. Omit where the visible
   *  compact text is already the name — an added prose label that does not contain
   *  the visible abbreviation trips axe's label-content-name-mismatch (WCAG 2.5.3). */
  ariaLabel?: string;
}

/**
 * 024 — a HUD chip whose expand-on-tap behaviour exists only below `sm`.
 *
 * At `sm` and up the chip's full labels always render, so the toggle changes
 * nothing — yet Tailwind Preflight gives every <button> `cursor: pointer`, so the
 * chip advertised a click that did nothing. Rendering a plain <div> there removes
 * the affordance and the handler together, while the narrow viewport (where the
 * toggle is how "D1/20" becomes "Season 1 · Spring Thaw") is untouched.
 */
export function ExpandableChip({
  expanded,
  onToggle,
  className,
  children,
  title,
  ariaLabel,
}: ExpandableChipProps) {
  const isDesktop = useMediaQuery(SM_QUERY);

  if (isDesktop) {
    return (
      <div className={className} title={title}>
        {children}
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={ariaLabel}
      title={title}
      onClick={onToggle}
      className={className}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/ExpandableChip.test.tsx`
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/ExpandableChip.tsx tests/components/ExpandableChip.test.tsx
git commit -m "feat(hud): add ExpandableChip — chip is interactive only below sm"
```

- [ ] **Step 6: Write the failing HUD integration test**

Append to `tests/components/HUD.test.tsx`:

```tsx
describe('HUD — 024 chips are inert at desktop widths', () => {
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

  it('renders neither the season nor the reputation chip as a button at sm+', () => {
    stubDesktop();
    render(<HUD {...baseProps} currentDay={1} coinBalance={100} harvestStreak={0} />);
    expect(screen.queryByRole('button', { name: /season 1 · spring thaw/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /reputation/i })).toBeNull();
  });

  it('still shows both chips content at sm+', () => {
    stubDesktop();
    render(<HUD {...baseProps} currentDay={1} coinBalance={100} harvestStreak={0} />);
    expect(screen.getByText(/Season 1 · Spring Thaw/)).toBeInTheDocument();
    expect(screen.getByText(/Struggling Smallholder/)).toBeInTheDocument();
  });
});
```

Add `afterEach` to the `vitest` import at the top of the file if it is not already there.

- [ ] **Step 7: Run test to verify it fails**

Run: `npx vitest run tests/components/HUD.test.tsx -t "024 chips"`
Expected: FAIL — both chips still resolve as buttons, so `queryByRole` returns an element

- [ ] **Step 8: Swap both chips over in `src/components/HUD.tsx`**

Add the import beside the existing component imports:

```tsx
import { ExpandableChip } from './ExpandableChip';
```

Replace the Day/Season chip (the `<button>` opening around line 161 through its closing
`</button>`) with:

```tsx
        <ExpandableChip
          expanded={seasonExpanded}
          onToggle={() => setSeasonExpanded(v => !v)}
          // No ariaLabel: the visible compact text ("Spring", "D1/20") is the
          // accessible name. A prose label here would not contain the visible
          // abbreviations and trips axe's label-content-name-mismatch (WCAG 2.5.3).
          className="flex min-h-[44px] md:min-h-0 flex-col justify-center leading-tight px-2.5 py-1 bg-[#261808] border border-[#5C3D1E]/60 rounded text-left"
        >
          <span className="font-pixel text-title text-farm-gold">
            <span className="sm:hidden">D{dayIntoSeason}/{seasonLen}</span>
            <span className="hidden sm:inline">Day {dayIntoSeason} / {seasonLen}</span>
          </span>
          <span className="font-pixel text-caption text-farm-parchment/70 uppercase tracking-widest">
            <span className="sm:hidden">{seasonMobileLabel}</span>
            <span className="hidden sm:inline">Season {season.number} · {season.name}</span>
          </span>
        </ExpandableChip>
```

Replace the Reputation chip (the `<button>` opening around line 213 through its closing
`</button>`) with:

```tsx
        <ExpandableChip
          expanded={repExpanded}
          onToggle={() => setRepExpanded(v => !v)}
          ariaLabel={`Reputation: ${reputation.title}`}
          title={`Reputation: ${reputation.title}. Your standing grows as you survive more days this run.`}
          className="flex min-h-[44px] md:min-h-0 items-center gap-1.5 bg-[#261808] px-2.5 py-1 rounded border border-[#5C3D1E]/60"
        >
          {/* Carries the "Reputation:" context in the non-interactive (sm+) mode,
              where there is no aria-label to supply it. Ignored below sm, where
              aria-label wins as the accessible name. */}
          <span className="sr-only">Reputation: </span>
          <span className="text-base leading-none -translate-y-[0.13em]" aria-hidden="true">🎖️</span>
          <span className={repTitleClass}>
            {reputation.title}
          </span>
        </ExpandableChip>
```

- [ ] **Step 9: Run the HUD suite**

Run: `npx vitest run tests/components/HUD.test.tsx`
Expected: PASS — the new "024 chips" tests, and every pre-existing test including
`toggles the season chip aria-expanded on click` and `toggles the reputation chip aria-expanded on
click` (both run under the default stub, which reports narrow, so they still get buttons).

- [ ] **Step 10: Run the full suite and lint**

Run: `npm test && npm run lint`
Expected: all green

- [ ] **Step 11: Commit**

```bash
git add src/components/HUD.tsx tests/components/HUD.test.tsx
git commit -m "fix(hud): stop day and reputation chips showing a pointer for a no-op at sm+"
```

---

## Task 2: The `credits_viewed` analytics event

**Files:**
- Modify: `src/analytics/events.ts` (`EventPropsMap` ~line 24-110, `EVENT_VERSIONS` ~line 119-141)
- Modify: `tests/analytics/events.test.ts`

**Context:** The analytics layer declares every event's prop shape in `EventPropsMap` and a version
per event in `EVENT_VERSIONS`. `EVENT_VERSIONS` is typed `Record<AnalyticsEventName, number>`, so
adding a key to the map without adding it to the versions record is a compile error — which is the
safety net here.

- [ ] **Step 1: Write the failing test**

Append to `tests/analytics/events.test.ts`, inside the existing `describe('events schema', …)`
block:

```ts
  it('declares credits_viewed at version 1', () => {
    expect(EVENT_VERSIONS.credits_viewed).toBe(1);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/analytics/events.test.ts -t "credits_viewed"`
Expected: FAIL — `expected undefined to be 1`

- [ ] **Step 3: Add the event**

In `src/analytics/events.ts`, add to `EventPropsMap` immediately after the
`first_harvest_collected` entry:

```ts
  /** 024 — the asset-attribution modal was opened from the game menu. */
  credits_viewed: Record<string, never>;
```

And add to `EVENT_VERSIONS`, after `first_harvest_collected: 1,`:

```ts
  credits_viewed: 1,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/analytics/events.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/analytics/events.ts tests/analytics/events.test.ts
git commit -m "feat(analytics): declare credits_viewed event"
```

---

## Task 3: The credits modal

**Files:**
- Create: `src/components/CreditsModal.tsx`
- Create: `tests/components/CreditsModal.test.tsx`

**Context:** The crop sprites derive from "[LPC] Crops" under CC-BY-SA 3.0+, which requires
crediting the original authors and linking back. `src/assets/crops/CREDITS-crops.txt` records the
full upstream text; this modal is the human-readable, in-product discharge of that obligation. The
dialog pattern follows [`FarmEventModal.tsx`](../../src/components/FarmEventModal.tsx) — a fixed
full-screen scrim, no portal — except this one *is* closable.

- [ ] **Step 1: Write the failing test**

Create `tests/components/CreditsModal.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreditsModal } from '../../src/components/CreditsModal';

afterEach(cleanup);

describe('CreditsModal', () => {
  it('credits the LPC crop authors and links back to the source', () => {
    render(<CreditsModal onClose={() => {}} />);
    expect(screen.getByText(/bluecarrot16/)).toBeInTheDocument();
    expect(screen.getByText(/Daniel Eddeland/)).toBeInTheDocument();
    expect(screen.getByText(/Joshua Taylor/)).toBeInTheDocument();
    expect(screen.getByText(/Richard Kettering/)).toBeInTheDocument();
    expect(screen.getByText(/CC-BY-SA 3\.0\+/)).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /opengameart\.org/i });
    expect(link).toHaveAttribute('href', 'https://opengameart.org/content/lpc-crops');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('credits the original art, the font and the audio', () => {
    render(<CreditsModal onClose={() => {}} />);
    expect(screen.getByText(/Original work by Vaclav Balak/i)).toBeInTheDocument();
    expect(screen.getByText(/Press Start 2P/)).toBeInTheDocument();
    expect(screen.getByText(/SIL Open Font License/i)).toBeInTheDocument();
    expect(screen.getByText(/Synthesised in-browser/i)).toBeInTheDocument();
  });

  it('is a labelled modal dialog', () => {
    render(<CreditsModal onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: /credits/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('closes on the Close button and on Escape', async () => {
    const onClose = vi.fn();
    render(<CreditsModal onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('moves focus to the Close button on mount', () => {
    render(<CreditsModal onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /close/i })).toHaveFocus();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<CreditsModal onClose={() => {}} />);
    // @ts-expect-error matcher registered in tests/setup.ts
    expect(await import('vitest-axe').then((m) => m.axe(container))).toHaveNoViolations();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/CreditsModal.test.tsx`
Expected: FAIL — `Failed to resolve import "../../src/components/CreditsModal"`

- [ ] **Step 3: Write the implementation**

Create `src/components/CreditsModal.tsx`:

```tsx
import { useEffect, useRef, type ReactNode } from 'react';

const LPC_URL = 'https://opengameart.org/content/lpc-crops';

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="font-pixel text-caption text-farm-stone uppercase tracking-widest">{heading}</h3>
      <p className="font-pixel text-caption text-farm-parchment leading-relaxed">{children}</p>
    </section>
  );
}

/**
 * 024 — asset attribution.
 *
 * The crop sprites derive from "[LPC] Crops", licensed CC-BY-SA 3.0+, which requires
 * naming the original authors and linking back to the source. The link is a real
 * anchor rather than plain text: a non-clickable URL is a weaker discharge of that
 * requirement. The full upstream record stays in src/assets/crops/CREDITS-crops.txt;
 * this is its human-readable summary.
 */
export function CreditsModal({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Credits"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-6"
    >
      <div className="max-w-sm w-full max-h-[80vh] overflow-y-auto bg-farm-soil border-2 border-farm-stone/40 rounded-lg p-5 flex flex-col gap-4">
        <h2 className="font-pixel text-title text-farm-gold">Credits</h2>

        <Section heading="Crop sprites">
          &quot;[LPC] Crops&quot; by bluecarrot16, Daniel Eddeland, Joshua Taylor and
          Richard Kettering. Commissioned by castelonia. Licensed CC-BY-SA 3.0+ / GPL-3.0+.{' '}
          <a
            href={LPC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-farm-gold underline break-all"
          >
            opengameart.org/content/lpc-crops
          </a>
        </Section>

        <Section heading="Backdrop, props and shop texture">
          Original work by Vaclav Balak.
        </Section>

        <Section heading="Font">
          Press Start 2P by CodeMan38, SIL Open Font License 1.1.
        </Section>

        <Section heading="Sound">
          Synthesised in-browser; no sampled audio.
        </Section>

        <p className="font-pixel text-caption text-farm-stone leading-relaxed">
          Game code © 2026 Vaclav Balak, MIT licensed.
        </p>

        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="
            font-pixel text-body px-4 py-2 min-h-[44px] rounded self-center
            bg-farm-grass text-farm-parchment
            hover:bg-farm-gold hover:text-farm-ink transition-colors
          "
        >
          Close
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/CreditsModal.test.tsx`
Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/CreditsModal.tsx tests/components/CreditsModal.test.tsx
git commit -m "feat(ui): add credits modal with LPC crop-art attribution"
```

---

## Task 4: Menu shell and the Sound row

**Files:**
- Create: `src/components/GameMenu.tsx`
- Create: `tests/components/GameMenu.test.tsx`

**Context:** The gear replaces `MuteToggle`'s slot in the HUD's right cluster. The popover must
close on outside click, on Escape, and on any row that acts — and must hand focus back to the gear
when it does, or a keyboard user is stranded. The Sound row wraps
[`src/audio/sfx.ts`](../../src/audio/sfx.ts)'s `isMuted`/`setMuted`, which persist under their own
localStorage key (`pixel-parsnips-audio`); nothing about that changes.

Note the polarity flip: the row says **Sound on/off**, while `sfx.ts` stores **muted**. `on` is
`!muted`.

- [ ] **Step 1: Write the failing test**

Create `tests/components/GameMenu.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameMenu } from '../../src/components/GameMenu';
import { AUDIO_KEY, isMuted } from '../../src/audio/sfx';

const noop = () => {};

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window.navigator, 'doNotTrack', { value: null, configurable: true });
});

afterEach(cleanup);

async function openMenu() {
  await userEvent.click(screen.getByRole('button', { name: /game menu/i }));
}

describe('GameMenu — popover shell', () => {
  it('renders a gear trigger and no menu until it is opened', () => {
    render(<GameMenu onRestart={noop} onReplayTutorial={noop} />);
    expect(screen.getByRole('button', { name: /game menu/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens on click and moves focus to the first row', async () => {
    render(<GameMenu onRestart={noop} onReplayTutorial={noop} />);
    await openMenu();
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /game menu/i })).toHaveAttribute('aria-expanded', 'true');
    const rows = screen.getAllByRole('menuitem');
    expect(rows[0]).toHaveFocus();
  });

  it('closes on Escape and returns focus to the gear', async () => {
    render(<GameMenu onRestart={noop} onReplayTutorial={noop} />);
    await openMenu();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('button', { name: /game menu/i })).toHaveFocus();
  });

  it('closes on an outside click', async () => {
    render(
      <div>
        <button type="button">outside</button>
        <GameMenu onRestart={noop} onReplayTutorial={noop} />
      </div>,
    );
    await openMenu();
    await userEvent.click(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('has no accessibility violations while open', async () => {
    const { container } = render(<GameMenu onRestart={noop} onReplayTutorial={noop} />);
    await openMenu();
    // @ts-expect-error matcher registered in tests/setup.ts
    expect(await import('vitest-axe').then((m) => m.axe(container))).toHaveNoViolations();
  });
});

describe('GameMenu — Sound row', () => {
  it('reads on by default and mutes on activation', async () => {
    render(<GameMenu onRestart={noop} onReplayTutorial={noop} />);
    await openMenu();

    const row = screen.getByRole('menuitemcheckbox', { name: /sound/i });
    expect(row).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(row);

    expect(row).toHaveAttribute('aria-checked', 'false');
    expect(isMuted()).toBe(true);
    expect(JSON.parse(localStorage.getItem(AUDIO_KEY)!)).toEqual({ schemaVersion: 1, muted: true });
  });

  it('initializes from the persisted muted value', async () => {
    localStorage.setItem(AUDIO_KEY, JSON.stringify({ schemaVersion: 1, muted: true }));
    render(<GameMenu onRestart={noop} onReplayTutorial={noop} />);
    await openMenu();
    expect(screen.getByRole('menuitemcheckbox', { name: /sound/i })).toHaveAttribute('aria-checked', 'false');
  });

  it('stays open after toggling sound', async () => {
    render(<GameMenu onRestart={noop} onReplayTutorial={noop} />);
    await openMenu();
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: /sound/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/GameMenu.test.tsx`
Expected: FAIL — `Failed to resolve import "../../src/components/GameMenu"`

- [ ] **Step 3: Write the implementation**

Create `src/components/GameMenu.tsx`. This is the shell plus the Sound row; Tasks 5–7 add the
remaining rows into the marked slots.

```tsx
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { isMuted, setMuted } from '../audio/sfx';
import { EmojiIcon } from './EmojiIcon';

/** Any row, action or toggle — `menuitem` and `menuitemcheckbox` both match. */
const ANY_ROW = '[role^="menuitem"]';

const ROW_CLASS = `
  w-full text-left font-pixel text-caption px-3 py-2.5 min-h-[44px] rounded
  text-farm-parchment/90
  hover:bg-[#3A2510] focus-visible:bg-[#3A2510]
  disabled:opacity-60 disabled:hover:bg-transparent
`;

interface ToggleRowProps {
  label: string;
  /** True when the feature is ON (not when it is disabled). */
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
  /** Extra explanation rendered under the label, in the accessible tree. */
  note?: ReactNode;
}

function ToggleRow({ label, on, onToggle, disabled = false, note }: ToggleRowProps) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={on}
      disabled={disabled}
      onClick={onToggle}
      className={ROW_CLASS}
    >
      <span className="flex items-center justify-between gap-3">
        <span>{label}</span>
        <span className="text-farm-gold uppercase tracking-widest">{on ? 'on' : 'off'}</span>
      </span>
      {note && <span className="block mt-1 text-farm-stone leading-relaxed">{note}</span>}
    </button>
  );
}

interface GameMenuProps {
  /** Abandons the live run and starts a fresh one. */
  onRestart: () => void;
  /** Flags the tutorial for replay and restarts the run. */
  onReplayTutorial: () => void;
}

/**
 * 024 — the game's only settings surface.
 *
 * Everything that is not gameplay lives here: sound, analytics consent, restart,
 * tutorial replay and asset credits. Rendered from the HUD only — the bankruptcy
 * and season-transition screens deliberately carry no chrome.
 */
export function GameMenu({ onRestart, onReplayTutorial }: GameMenuProps) {
  const [open, setOpen] = useState(false);
  const [muted, setMutedState] = useState(() => isMuted());
  const gearRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    gearRef.current?.focus();
  }, []);

  // Focus the first row on open so the menu is usable from the keyboard.
  useEffect(() => {
    if (!open) return;
    popoverRef.current?.querySelector<HTMLElement>(ANY_ROW)?.focus();
  }, [open]);

  // Escape and outside-click both dismiss. Bound to the document so they work
  // wherever focus currently sits — including inside the popover.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target) || gearRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, close]);

  function toggleSound() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  }

  return (
    <div className="relative">
      <button
        ref={gearRef}
        type="button"
        aria-label="Game menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(v => !v)}
        className="
          font-pixel text-caption px-2 py-1.5 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 rounded
          bg-[#261808] text-farm-stone/60 border border-[#5C3D1E]/50
          hover:bg-[#3A2510] hover:text-farm-parchment/80 hover:border-[#5C3D1E]
          active:scale-95 transition-all
        "
      >
        <EmojiIcon>⚙️</EmojiIcon>
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="menu"
          aria-label="Game menu"
          className="
            absolute right-0 top-full mt-1 z-50 w-60
            flex flex-col gap-0.5 p-1
            bg-farm-soil border border-[#5C3D1E] rounded-lg
          "
        >
          {/* Task 6 inserts the Restart and Replay tutorial rows here. */}
          <ToggleRow label="Sound" on={!muted} onToggle={toggleSound} />
          {/* Task 5 inserts the Anonymous analytics row here. */}
          {/* Task 7 inserts the Credits row here. */}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/GameMenu.test.tsx`
Expected: PASS — the shell tests plus the three Sound tests.

Note: `it('opens on click and moves focus to the first row')` queries `getAllByRole('menuitem')`,
which does **not** match `menuitemcheckbox`. Until Task 6 adds the Restart action row there is no
`menuitem` in the tree, so that one test fails with "Unable to find role". **This is expected at
this point.** Change that single assertion to `screen.getByRole('menuitemcheckbox', { name: /sound/i })`
now, and Task 6 restores the `menuitem` form once the action rows exist.

- [ ] **Step 5: Commit**

```bash
git add src/components/GameMenu.tsx tests/components/GameMenu.test.tsx
git commit -m "feat(ui): add GameMenu popover shell with the Sound row"
```

---

## Task 5: The analytics consent row

**Files:**
- Modify: `src/components/GameMenu.tsx`
- Modify: `tests/components/GameMenu.test.tsx`
- Delete: `tests/components/AnalyticsOptOutToggle.test.tsx` (behaviour migrated here)

**Context:** This absorbs `AnalyticsOptOutToggle` wholesale. Three states, not two: opted in, opted
out, and **browser Do Not Track**, which hard-disables tracking regardless of the local flag. Today
DNT is explained only by a `title` tooltip — unreachable on touch. In the menu it becomes visible
sub-text, which is the whole reason this control gained room to breathe.

`optOut()`/`optIn()` write the localStorage flag; `setAnalyticsOptOut()` tells the live PostHog
client. Both must be called, in that order, exactly as the old component did.

- [ ] **Step 1: Write the failing test**

Add to `tests/components/GameMenu.test.tsx`. Add these two lines to the top-level imports:

```tsx
import { ANALYTICS_OPT_OUT_KEY } from '../../src/analytics/consent';
```

and at the very top of the file, above the other imports, the module mock:

```tsx
const { setAnalyticsOptOut, track } = vi.hoisted(() => ({
  setAnalyticsOptOut: vi.fn(),
  track: vi.fn(),
}));
vi.mock('../../src/analytics/track', () => ({ setAnalyticsOptOut, track }));
```

Add `setAnalyticsOptOut.mockClear(); track.mockClear();` to the existing `beforeEach`.

Then append the describe block:

```tsx
describe('GameMenu — analytics row', () => {
  it('reads on by default and opts out on activation', async () => {
    render(<GameMenu onRestart={noop} onReplayTutorial={noop} />);
    await openMenu();

    const row = screen.getByRole('menuitemcheckbox', { name: /anonymous analytics/i });
    expect(row).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(row);

    expect(localStorage.getItem(ANALYTICS_OPT_OUT_KEY)).toBe('true');
    expect(setAnalyticsOptOut).toHaveBeenCalledWith(true);
    expect(row).toHaveAttribute('aria-checked', 'false');
  });

  it('reflects a persisted opted-out state and opts back in', async () => {
    localStorage.setItem(ANALYTICS_OPT_OUT_KEY, 'true');
    render(<GameMenu onRestart={noop} onReplayTutorial={noop} />);
    await openMenu();

    const row = screen.getByRole('menuitemcheckbox', { name: /anonymous analytics/i });
    expect(row).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(row);

    expect(localStorage.getItem(ANALYTICS_OPT_OUT_KEY)).toBeNull();
    expect(setAnalyticsOptOut).toHaveBeenCalledWith(false);
  });

  it('is inert under Do Not Track and explains why in readable text', async () => {
    Object.defineProperty(window.navigator, 'doNotTrack', { value: '1', configurable: true });
    render(<GameMenu onRestart={noop} onReplayTutorial={noop} />);
    await openMenu();

    const row = screen.getByRole('menuitemcheckbox', { name: /anonymous analytics/i });
    expect(row).toHaveAttribute('aria-checked', 'false');
    expect(row).toBeDisabled();
    // The reason must be real text, not a title tooltip — tooltips do not exist on touch.
    expect(row).toHaveTextContent(/do not track/i);

    await userEvent.click(row);

    expect(localStorage.getItem(ANALYTICS_OPT_OUT_KEY)).toBeNull();
    expect(setAnalyticsOptOut).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/GameMenu.test.tsx -t "analytics row"`
Expected: FAIL — `Unable to find an accessible element with the role "menuitemcheckbox" and name /anonymous analytics/i`

- [ ] **Step 3: Add the row**

In `src/components/GameMenu.tsx`, add to the imports:

```tsx
import { isDoNotTrack, isOptedOut, optIn, optOut } from '../analytics/consent';
import { setAnalyticsOptOut } from '../analytics/track';
```

Add to the component's state, beside `muted`:

```tsx
  const [optedOut, setOptedOut] = useState(() => isOptedOut());
  // DNT hard-disables tracking regardless of the local flag; reflect that so the
  // row never implies analytics are live when track() will always no-op.
  const dntActive = isDoNotTrack();
```

Add the handler next to `toggleSound`:

```tsx
  function toggleAnalytics() {
    if (dntActive) return;
    const next = !optedOut;
    if (next) optOut();
    else optIn();
    setAnalyticsOptOut(next);
    setOptedOut(next);
  }
```

Replace the `{/* Task 5 … */}` comment with:

```tsx
          <ToggleRow
            label="Anonymous analytics"
            on={!optedOut && !dntActive}
            onToggle={toggleAnalytics}
            disabled={dntActive}
            note={dntActive ? "Your browser's Do Not Track setting is on." : undefined}
          />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/GameMenu.test.tsx`
Expected: PASS

- [ ] **Step 5: Delete the superseded test file**

```bash
git rm tests/components/AnalyticsOptOutToggle.test.tsx
```

The component itself is deleted in Task 9, once `App` stops importing it. Removing its test now
would leave a window with an untested component, so the order matters: test first (migrated above),
component last.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS. `src/components/AnalyticsOptOutToggle.tsx` is now untested but still rendered by
`App`; that is resolved in Task 9.

- [ ] **Step 7: Commit**

```bash
git add src/components/GameMenu.tsx tests/components/GameMenu.test.tsx tests/components/AnalyticsOptOutToggle.test.tsx
git commit -m "feat(ui): move analytics consent into the game menu with visible DNT reason"
```

---

## Task 6: The two run-resetting rows

**Files:**
- Modify: `src/components/GameMenu.tsx`
- Modify: `tests/components/GameMenu.test.tsx`

**Context:** Both rows throw away a live run, so both use a two-step arm — one activation arms, a
second confirms — matching the `UnwinnableBanner` pattern already in
[`GameBoard.tsx:194`](../../src/components/GameBoard.tsx). Arming auto-expires so a much-later tap
cannot restart without a fresh first tap. The spec sets that window at 5 seconds (the banner uses
3s; the menu is a deliberate visit rather than an ambient banner, so it gets a little longer).

"Replay tutorial" **also restarts** — it calls the same `restart()` after flagging the tutorial. The
label says so, because an in-place replay would point the tutorial's anchors at a board state they
do not describe.

- [ ] **Step 1: Write the failing test**

Append to `tests/components/GameMenu.test.tsx`:

```tsx
describe('GameMenu — run-resetting rows', () => {
  it('requires two activations to restart', async () => {
    const onRestart = vi.fn();
    render(<GameMenu onRestart={onRestart} onReplayTutorial={noop} />);
    await openMenu();

    const row = screen.getByRole('menuitem', { name: /restart run/i });
    await userEvent.click(row);
    expect(onRestart).not.toHaveBeenCalled();

    const armed = screen.getByRole('menuitem', { name: /tap again to restart/i });
    await userEvent.click(armed);
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it('closes the menu once restart is confirmed', async () => {
    render(<GameMenu onRestart={noop} onReplayTutorial={noop} />);
    await openMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: /restart run/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /tap again to restart/i }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('disarms restart when the menu is closed and reopened', async () => {
    const onRestart = vi.fn();
    render(<GameMenu onRestart={onRestart} onReplayTutorial={noop} />);
    await openMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: /restart run/i }));

    await userEvent.keyboard('{Escape}');
    await openMenu();

    // Back to the unarmed label; a single click must not restart.
    await userEvent.click(screen.getByRole('menuitem', { name: /restart run/i }));
    expect(onRestart).not.toHaveBeenCalled();
  });

  it('disarms restart after the arm window elapses', async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onRestart = vi.fn();
    render(<GameMenu onRestart={onRestart} onReplayTutorial={noop} />);

    await user.click(screen.getByRole('button', { name: /game menu/i }));
    await user.click(screen.getByRole('menuitem', { name: /restart run/i }));
    expect(screen.getByRole('menuitem', { name: /tap again to restart/i })).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(5000);

    expect(screen.getByRole('menuitem', { name: /restart run/i })).toBeInTheDocument();
    expect(onRestart).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('says out loud that replaying the tutorial restarts the run', async () => {
    const onReplayTutorial = vi.fn();
    render(<GameMenu onRestart={noop} onReplayTutorial={onReplayTutorial} />);
    await openMenu();

    const row = screen.getByRole('menuitem', { name: /replay tutorial \(restarts run\)/i });
    await userEvent.click(row);
    expect(onReplayTutorial).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('menuitem', { name: /tap again to replay/i }));
    expect(onReplayTutorial).toHaveBeenCalledTimes(1);
  });
});
```

Also restore the shell test from Task 4 Step 4 to its original form, now that `menuitem` rows exist:

```tsx
    const rows = screen.getAllByRole('menuitem');
    expect(rows[0]).toHaveFocus();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/GameMenu.test.tsx -t "run-resetting"`
Expected: FAIL — `Unable to find an accessible element with the role "menuitem" and name /restart run/i`

- [ ] **Step 3: Add `ArmedRow` and the two rows**

In `src/components/GameMenu.tsx`, add the constant beside `ROW_CLASS`:

```tsx
/** How long a two-step row stays armed before disarming itself. */
const ARM_TIMEOUT_MS = 5000;
```

Add the component below `ToggleRow`:

```tsx
interface ArmedRowProps {
  label: string;
  /** Shown after the first activation, in place of `label`. */
  armedLabel: string;
  onConfirm: () => void;
}

/**
 * A row that destroys the live run, so it takes two activations. Auto-disarms
 * after ARM_TIMEOUT_MS so a much-later tap cannot confirm without a fresh first
 * tap. Mirrors the UnwinnableBanner pattern in GameBoard.
 */
function ArmedRow({ label, armedLabel, onConfirm }: ArmedRowProps) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), ARM_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      className={`${ROW_CLASS} ${armed ? 'text-farm-red' : ''}`}
    >
      {armed ? armedLabel : label}
    </button>
  );
}
```

Replace the `{/* Task 6 … */}` comment with:

```tsx
          <ArmedRow
            label="Restart run"
            armedLabel="Tap again to restart"
            onConfirm={() => {
              setOpen(false);
              onRestart();
            }}
          />
          <ArmedRow
            label="Replay tutorial (restarts run)"
            armedLabel="Tap again to replay"
            onConfirm={() => {
              setOpen(false);
              onReplayTutorial();
            }}
          />
```

`setOpen(false)` rather than `close()`: the run is being torn down and re-rendered, so returning
focus to a gear that is about to remount would be pointless churn.

Because `ArmedRow` unmounts when the popover closes, its `armed` state resets on every reopen —
which is exactly the "disarms when closed and reopened" behaviour, with no extra bookkeeping.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/GameMenu.test.tsx`
Expected: PASS — including the restored `getAllByRole('menuitem')` focus assertion, since Restart is
now the first row.

- [ ] **Step 5: Commit**

```bash
git add src/components/GameMenu.tsx tests/components/GameMenu.test.tsx
git commit -m "feat(ui): add two-step restart and tutorial-replay rows to the game menu"
```

---

## Task 7: The credits row

**Files:**
- Modify: `src/components/GameMenu.tsx`
- Modify: `tests/components/GameMenu.test.tsx`

**Context:** The row opens `CreditsModal` (Task 3) and fires the `credits_viewed` event (Task 2).
The popover closes without returning focus to the gear — the modal takes focus on mount — and the
modal's own close hands focus back.

- [ ] **Step 1: Write the failing test**

Append to `tests/components/GameMenu.test.tsx`:

```tsx
describe('GameMenu — credits row', () => {
  it('opens the credits modal, closes the popover, and tracks the view', async () => {
    render(<GameMenu onRestart={noop} onReplayTutorial={noop} />);
    await openMenu();

    await userEvent.click(screen.getByRole('menuitem', { name: /credits/i }));

    expect(screen.getByRole('dialog', { name: /credits/i })).toBeInTheDocument();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(track).toHaveBeenCalledWith('credits_viewed', {});
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('returns focus to the gear when the credits modal closes', async () => {
    render(<GameMenu onRestart={noop} onReplayTutorial={noop} />);
    await openMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: /credits/i }));

    await userEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: /game menu/i })).toHaveFocus();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/GameMenu.test.tsx -t "credits row"`
Expected: FAIL — `Unable to find an accessible element with the role "menuitem" and name /credits/i`

- [ ] **Step 3: Add the row**

In `src/components/GameMenu.tsx`, extend the imports:

```tsx
import { setAnalyticsOptOut, track } from '../analytics/track';
import { CreditsModal } from './CreditsModal';
```

(replacing the existing `setAnalyticsOptOut`-only import line).

Add state beside the others:

```tsx
  const [creditsOpen, setCreditsOpen] = useState(false);
```

Add the handler beside `toggleAnalytics`:

```tsx
  function openCredits() {
    track('credits_viewed', {});
    // Not close(): the modal takes focus on mount, so bouncing focus through the
    // gear first would be a visible detour. The modal returns it on close.
    setOpen(false);
    setCreditsOpen(true);
  }
```

Replace the `{/* Task 7 … */}` comment with:

```tsx
          <button type="button" role="menuitem" onClick={openCredits} className={ROW_CLASS}>
            Credits
          </button>
```

And render the modal as a sibling of the popover, just before the closing `</div>` of the
component's root:

```tsx
      {creditsOpen && (
        <CreditsModal
          onClose={() => {
            setCreditsOpen(false);
            gearRef.current?.focus();
          }}
        />
      )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/GameMenu.test.tsx`
Expected: PASS — the whole GameMenu suite

- [ ] **Step 5: Run the full suite and lint**

Run: `npm test && npm run lint`
Expected: all green

- [ ] **Step 6: Commit**

```bash
git add src/components/GameMenu.tsx tests/components/GameMenu.test.tsx
git commit -m "feat(ui): add credits row to the game menu"
```

---

## Task 8: Wire the menu into the HUD and delete `MuteToggle`

**Files:**
- Modify: `src/components/HUD.tsx`
- Modify: `src/components/GameBoard.tsx` (props interface ~line 327, destructure ~line 351, `<HUD>` ~line 481)
- Modify: `src/App.tsx`
- Modify: `tests/components/HUD.test.tsx`
- Modify: `tests/components/GameMenu.test.tsx` (absorb the last MuteToggle assertion)
- Delete: `src/components/MuteToggle.tsx`, `tests/components/MuteToggle.test.tsx`

**Context:** `HUD` currently has neither `onRestart` nor `onReplayTutorial`. `GameBoard` already
receives `onRestart` (it feeds `UnwinnableBanner`) but not `onReplayTutorial`, so that one is
threaded down from `App`, where the identical handler already exists for the bankruptcy screen.
Extract it once rather than writing it twice.

- [ ] **Step 1: Write the failing test**

Append to `tests/components/HUD.test.tsx`:

```tsx
describe('HUD — 024 game menu', () => {
  it('renders the gear trigger', () => {
    render(<HUD {...baseProps} currentDay={1} coinBalance={100} />);
    expect(screen.getByRole('button', { name: /game menu/i })).toBeInTheDocument();
  });

  it('no longer renders a standalone mute button', () => {
    render(<HUD {...baseProps} currentDay={1} coinBalance={100} />);
    expect(screen.queryByRole('button', { name: /mute sound effects/i })).toBeNull();
  });

  it('keeps Last Turn on the HUD rather than in the menu', () => {
    render(<HUD {...baseProps} currentDay={1} coinBalance={100} hasLastTurn />);
    expect(screen.getByRole('button', { name: /view last turn summary/i })).toBeInTheDocument();
  });
});
```

Add `onRestart: vi.fn(), onReplayTutorial: vi.fn(),` to the `baseProps` object at the top of the
file, and to the `renderHUD` helper's inline props near the bottom.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/HUD.test.tsx -t "024 game menu"`
Expected: FAIL — no button named "Game menu"; the mute button is still present

- [ ] **Step 3: Update `HUD.tsx`**

Replace the import:

```tsx
import { MuteToggle } from './MuteToggle';
```

with:

```tsx
import { GameMenu } from './GameMenu';
```

Add to `HUDProps`, after `contract`:

```tsx
  /** 024 — abandons the live run from the game menu. */
  onRestart: () => void;
  /** 024 — flags the tutorial for replay and restarts, from the game menu. */
  onReplayTutorial: () => void;
```

Add `onRestart,` and `onReplayTutorial,` to the destructured parameter list.

Replace `<MuteToggle />` in the right-hand button cluster with:

```tsx
          <GameMenu onRestart={onRestart} onReplayTutorial={onReplayTutorial} />
```

- [ ] **Step 4: Update `GameBoard.tsx`**

Add to the props interface, beside the existing `onRestart: () => void;`:

```tsx
  /** 024 — threaded to the HUD's game menu; flags tutorial replay and restarts. */
  onReplayTutorial: () => void;
```

Add `onReplayTutorial,` to the destructured parameter list beside `onRestart,`.

Add both props to the `<HUD …>` element, after `contract={contractChip}`:

```tsx
        onRestart={onRestart}
        onReplayTutorial={onReplayTutorial}
```

- [ ] **Step 5: Update `App.tsx`**

Add the imports if absent (`requestOnboardingReplay` and `track` are already imported).

Immediately after the destructure line
`const { state, restart, continueSeason, endRunVictory, endOfRunRecap } = engine;`, add:

```tsx
  // Shared by the bankruptcy screen and the in-run game menu (024): flag the
  // tutorial for replay, then reset the run so it starts from day 1.
  const handleReplayTutorial = () => {
    track('onboarding_replay_requested', {});
    requestOnboardingReplay();
    restart();
  };
```

Replace the inline handler on `<BankruptcyScreen>`:

```tsx
            onReplayTutorial={handleReplayTutorial}
```

Add to `<GameBoard>`, after `onRestart={restart}`:

```tsx
        onReplayTutorial={handleReplayTutorial}
```

- [ ] **Step 6: Migrate the last uncovered MuteToggle assertion**

`tests/components/MuteToggle.test.tsx` asserted three behaviours; two are already covered by the
Sound-row tests in Task 4. The third — that the control reflects a persisted value on a **fresh
mount** — is also covered ("initializes from the persisted muted value"). Nothing further to
migrate; delete the file.

```bash
git rm tests/components/MuteToggle.test.tsx src/components/MuteToggle.tsx
```

- [ ] **Step 7: Confirm the modal edge case needs no machinery, and record why**

The spec's edge-case table says: *"Menu open when a farm event or day summary modal opens → Popover
closes; game modals own the screen."* Do **not** build a `forceClose` prop for this. Check the two
reasons it is already true, then write them down so the next reader does not re-litigate it:

1. **Z-order.** The popover is `z-50` inside the HUD. `FarmEventModal` is `z-[60]`, `EmptyDayConfirm`
   is `z-[55]`, and the day-summary modal is a full-screen scrim. Each covers the popover completely.
2. **Every path that opens one of those modals starts with a click outside the popover** — Next Day
   in the HUD, or a button in the bottom action bar. That click fires the document `mousedown`
   handler installed in Task 4, which closes the popover before the modal mounts.

Verify #2 by hand in the smoke check (final verification, item 8). Then add this comment above the
outside-click effect in `src/components/GameMenu.tsx`:

```tsx
  // This also covers the "a game modal opened while the menu was up" case: every
  // path to a modal (Next Day, the action bar) begins with a click outside the
  // popover, which lands here first. No explicit force-close prop is needed, and
  // the modals' higher z-index covers the popover in any case.
```

- [ ] **Step 8: Run the full suite and lint**

Run: `npm test && npm run lint`
Expected: all green. `GameBoard.test.tsx` and its siblings render `GameBoard`, so any missing
`onReplayTutorial` prop surfaces as a TypeScript error at build time — if `npm run build` complains
about a test file, add `onReplayTutorial={vi.fn()}` to that render call.

- [ ] **Step 9: Verify the build typechecks**

Run: `npm run build`
Expected: succeeds — this is the only step that runs `tsc -b` over the whole project.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(hud): replace the mute button with the game menu"
```

---

## Task 9: Remove the floating analytics chip

**Files:**
- Modify: `src/App.tsx`
- Delete: `src/components/AnalyticsOptOutToggle.tsx`
- Modify: `tests/App.analytics.test.tsx`

**Context:** `App` renders `<AnalyticsOptOutToggle />` twice — once on the bankruptcy branch, once
on the playing branch. Both go. This is what makes the menu HUD-only: the bankruptcy screen ends up
with no chrome at all, which is the intent (it is the highest-intent moment in the game and should
carry restart and nothing else).

- [ ] **Step 1: Write the failing test**

Append to `tests/App.analytics.test.tsx`:

```tsx
describe('App — 024 chrome consolidation', () => {
  it('renders no floating analytics control', () => {
    render(<App />);
    expect(screen.queryByRole('button', { name: /^analytics:/i })).toBeNull();
  });
});
```

Add `screen` to the `@testing-library/react` import if it is not already there.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/App.analytics.test.tsx -t "024 chrome"`
Expected: FAIL — the `Analytics: on` button is still rendered

- [ ] **Step 3: Remove it**

In `src/App.tsx`:

- Delete the import line `import { AnalyticsOptOutToggle } from './components/AnalyticsOptOutToggle';`
- Delete `<AnalyticsOptOutToggle />` from the bankruptcy branch's fragment
- Delete `<AnalyticsOptOutToggle />` from the main return's fragment

The bankruptcy branch's `<>…</>` fragment now wraps only `<GrainFilter />` and the `<Suspense>`;
leave the fragment in place, it still wraps two children.

- [ ] **Step 4: Delete the component**

```bash
git rm src/components/AnalyticsOptOutToggle.tsx
```

- [ ] **Step 5: Pin the HUD-only scope with a test**

The spec's scope decision is that terminal screens carry no chrome at all. Assert it where it is
cheap to assert — on the screen itself, rather than by driving a whole run to bankruptcy.

Append to `tests/components/BankruptcyScreen.test.tsx`:

```tsx
describe('BankruptcyScreen — 024 carries no chrome', () => {
  it('renders neither the game menu nor an analytics control', () => {
    render(
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
      />,
    );
    expect(screen.queryByRole('button', { name: /game menu/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^analytics:/i })).toBeNull();
    // Restart is the one action this screen keeps.
    expect(screen.getByRole('button', { name: /restart game/i })).toBeInTheDocument();
  });
});
```

If the existing file already has a props-builder helper, use it instead of the inline literal above
and pass only the overrides that matter.

Run: `npx vitest run tests/components/BankruptcyScreen.test.tsx`
Expected: PASS

- [ ] **Step 6: Run the full suite, lint and build**

Run: `npm test && npm run lint && npm run build`
Expected: all green

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(app): drop the floating analytics chip, now a game-menu row"
```

---

## Task 10: Asset licence carve-out

**Files:**
- Modify: `LICENSE`
- Modify: `README.md` (the `## License` section, ~line 83)

**Context:** `LICENSE` is plain MIT, which is inaccurate now that the crop sprites are known to be
LPC-derived under CC-BY-SA 3.0+. Share-alike applies to derivatives **of the crop art**, not to the
game as a collective work — the code stays MIT. The carve-out states that boundary; it relicenses
nothing.

- [ ] **Step 1: Append the carve-out to `LICENSE`**

Add at the end of the file, after the MIT text:

```
---

## Assets

The MIT licence above covers the source code only.

Crop sprites in `src/assets/crops/` derive from "[LPC] Crops" by bluecarrot16,
Daniel Eddeland, Joshua Taylor and Richard Kettering, commissioned by castelonia,
and remain licensed CC-BY-SA 3.0+ / GPL-3.0+. Full attribution and the upstream
item list are in `src/assets/crops/CREDITS-crops.txt`.
Source: https://opengameart.org/content/lpc-crops

All other art in `src/assets/` is original work by the author, MIT licensed with
the code.

The Press Start 2P font ships via @fontsource under the SIL Open Font License 1.1.
```

- [ ] **Step 2: Update the README section**

Replace the two lines under `## License` in `README.md`:

```markdown
## License

MIT License for the source code. See `LICENSE`.

**Assets are licensed separately.** Crop sprites derive from
[[LPC] Crops](https://opengameart.org/content/lpc-crops) (CC-BY-SA 3.0+ / GPL-3.0+);
all other art is original work. In-game attribution lives under the ⚙️ menu →
Credits. Full detail in `LICENSE` and `src/assets/crops/CREDITS-crops.txt`.
```

- [ ] **Step 3: Verify the claim matches the modal**

Run: `git diff LICENSE README.md`
Expected: the four author names and the CC-BY-SA 3.0+ / GPL-3.0+ pairing read identically here and
in `src/components/CreditsModal.tsx`. If they differ, the modal is the one users see — make the
files match it.

- [ ] **Step 4: Commit**

```bash
git add LICENSE README.md
git commit -m "docs: carve assets out of the MIT licence"
```

---

## Final verification

- [ ] **Run everything**

```bash
npm test && npm run lint && npm run build
```

Expected: suite green, no lint errors, build succeeds.

- [ ] **Manual smoke check in the browser**

Start the dev server and confirm, in this order:

1. The gear appears top-right in the HUD; the old `Analytics: on` chip is gone from the bottom-left.
2. Opening the menu shows five rows; Sound and Anonymous analytics show `on`.
3. One click on **Restart run** changes the label; a second click resets the game to day 1.
4. **Credits** opens the modal; the OpenGameArt link is clickable; Close returns to the game.
5. At a desktop width, hovering the Day and Reputation chips shows the **default arrow cursor**.
6. At a phone width (≤639px), tapping the Day chip still expands `D1/20` to `Season 1 · Spring Thaw`.
7. Going bankrupt shows the bankruptcy screen with **no gear and no analytics chip**.
8. Open the menu, then press **Next Day** without closing it — the popover dismisses and the day
   summary owns the screen (the Task 8 Step 7 edge case, verified by hand).

- [ ] **Confirm the spec's non-goals held**

```bash
git diff --stat master -- src/engine
```

Expected: **no output.** This feature touches no engine file, no `GameState` field, and no
`SCHEMA_VERSION`. If `src/engine` shows changes, something has drifted from the spec.
