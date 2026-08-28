import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HUD } from '../../src/components/HUD';

const baseProps = {
  onNextDay: vi.fn(),
  onLastTurn: vi.fn(),
  isProcessing: false,
  hasLastTurn: false,
  endlessMode: false,
  canAdvanceProductively: true,
  contract: null,
  harvestStreak: 0,
  onRestart: vi.fn(),
  onReplayTutorial: vi.fn(),
};

describe('HUD — Season indicator (US1)', () => {
  it('renders season name and day-into-season on Day 1', () => {
    render(<HUD {...baseProps} currentDay={1} coinBalance={100} />);
    expect(screen.getByText(/Spring Thaw/i)).toBeInTheDocument();
    expect(screen.getByText(/Day 1 \/ 20/i)).toBeInTheDocument();
  });

  it('renders Season 2 (Summer Heat) on Day 25', () => {
    render(<HUD {...baseProps} currentDay={25} coinBalance={200} />);
    expect(screen.getByText(/Summer Heat/i)).toBeInTheDocument();
    expect(screen.getByText(/Day 5 \/ 20/i)).toBeInTheDocument();
  });

  it('renders the season target alongside the coin balance', () => {
    render(<HUD {...baseProps} currentDay={1} coinBalance={87} />);
    expect(screen.getByText(/87/)).toBeInTheDocument();
    expect(screen.getByText(/goal 105 by day 20/i)).toBeInTheDocument();
  });
});

describe('HUD — season goal deadline framing (017 FR-008/FR-009)', () => {
  it('presents the target as a deadline, not a completed fraction', () => {
    render(<HUD {...baseProps} currentDay={1} coinBalance={130} />);
    // Season 1 target is 105, season length 20
    expect(screen.getByText(/goal 105 by day 20/i)).toBeInTheDocument();
    expect(screen.queryByText(/130 \/ 105/)).toBeNull();
  });

  it('does not style the balance as achieved while the season is undecided', () => {
    render(<HUD {...baseProps} currentDay={1} coinBalance={130} />);
    const coins = screen.getByLabelText(/coins: 130/i);
    expect(coins.className).not.toContain('text-[#5FB54A]');
  });
});

describe('HUD — Day 18+ warning and Day 20 preview (US6)', () => {
  it('shows "3 days left" warning at Day 18 when target not met', () => {
    render(<HUD {...baseProps} currentDay={18} coinBalance={50} />);
    expect(screen.getByText(/3 days left/i)).toBeInTheDocument();
  });

  it('suppresses warning at Day 18 when target already met', () => {
    render(<HUD {...baseProps} currentDay={18} coinBalance={200} />);
    expect(screen.queryByText(/days left/i)).not.toBeInTheDocument();
  });

  it('shows lease preview on Day 20 of Season 1', () => {
    render(<HUD {...baseProps} currentDay={20} coinBalance={150} />);
    expect(screen.getByText(/rises to 22 next season/i)).toBeInTheDocument();
  });

  it('does NOT show lease preview on Day 80 (Season 4) when endlessMode is false', () => {
    render(<HUD {...baseProps} currentDay={80} coinBalance={600} endlessMode={false} />);
    expect(screen.queryByText(/rises to .* next season/i)).not.toBeInTheDocument();
  });

  it('shows lease preview on Day 80 when endlessMode is true', () => {
    render(<HUD {...baseProps} currentDay={80} coinBalance={600} endlessMode={true} />);
    expect(screen.getByText(/rises to 32 next season/i)).toBeInTheDocument();
  });

  it('shows correct Endless lease preview on Day 100 (Endless Season 5 endDay → Endless Season 6 lease)', () => {
    render(<HUD {...baseProps} currentDay={100} coinBalance={800} endlessMode={true} />);
    expect(screen.getByText(/rises to 34 next season/i)).toBeInTheDocument();
  });
});

// 027 — the reputation title restated the day counter that already dominates the HUD,
// so the chip is gone and the ladder now lives on the medal (src/engine/medals.ts).
describe('HUD — 027 reputation chip removed', () => {
  it('renders no reputation chip', () => {
    render(<HUD {...baseProps} currentDay={14} coinBalance={100} />);
    expect(screen.queryByLabelText(/reputation/i)).toBeNull();
  });

  it('renders no reputation title text at any day', () => {
    for (const day of [1, 14, 21, 41, 81]) {
      const { unmount } = render(<HUD {...baseProps} currentDay={day} coinBalance={100} />);
      expect(screen.queryByText(/Smallholder|Homesteader|Apprentice|Grower|Agronomist|Master of the Harvest|Cultivator/i)).toBeNull();
      unmount();
    }
  });
});

// The ledger chip carries one figure again: the per-day lease. The harvest streak moved
// out of it into a pulsing flame on the day chip (below) — a streak is an at-a-glance
// state, not a number you read, so the coins it earns live in the flame's tooltip.
// In jsdom there is no Tailwind CSS, so `sm:hidden` and `hidden sm:inline` spans are all
// present in the DOM; tests that care about one width query that width's spans directly.
describe('HUD — daily ledger chip', () => {
  /** Concatenated text of the chip's mobile-only spans. */
  function mobileText(chip: HTMLElement): string {
    return [...chip.querySelectorAll('.sm\\:hidden')].map(e => e.textContent).join('');
  }

  it('shows the lease at streak 0', () => {
    render(<HUD {...baseProps} currentDay={5} coinBalance={100} harvestStreak={0} />);
    const chip = screen.getByLabelText(/lease: 15 coins per day/i);
    expect(mobileText(chip)).toBe('−15/d');
    expect(chip).toHaveTextContent(/Lease 15/);
  });

  it('keeps the same lease form when a streak is live', () => {
    render(<HUD {...baseProps} currentDay={5} coinBalance={100} harvestStreak={3} />);
    const chip = screen.getByLabelText(/lease: 15 coins per day/i);
    expect(mobileText(chip)).toBe('−15/d');
  });

  it('carries no streak bonus figure', () => {
    render(<HUD {...baseProps} currentDay={5} coinBalance={100} harvestStreak={3} />);
    const chip = screen.getByLabelText(/lease: 15 coins per day/i);
    expect(chip).not.toHaveTextContent(/\+\d/);
  });

  it('keeps emoji out of the mobile form (width budget — see spec.md)', () => {
    render(<HUD {...baseProps} currentDay={5} coinBalance={100} harvestStreak={3} />);
    const chip = screen.getByLabelText(/lease: 15 coins per day/i);
    expect(mobileText(chip)).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('shows the end-of-season lease preview in the sm+ form', () => {
    render(<HUD {...baseProps} currentDay={20} coinBalance={300} />);
    const chip = screen.getByLabelText(/lease: 15 coins per day/i);
    expect(chip).toHaveTextContent(/rises to 22 next season/);
  });

  it('omits the preview on any day but the last of the season', () => {
    render(<HUD {...baseProps} currentDay={19} coinBalance={300} />);
    const chip = screen.getByLabelText(/lease: 15 coins per day/i);
    expect(chip).not.toHaveTextContent(/rises to/);
  });

  it('no longer renders a standalone harvest-streak chip', () => {
    render(<HUD {...baseProps} currentDay={5} coinBalance={100} harvestStreak={3} />);
    expect(screen.queryByLabelText(/^Harvest streak: \d+ days$/)).toBeNull();
  });

  it('shows the lease at mobile widths — the chip is never width-gated (F7)', () => {
    const { container } = render(<HUD {...baseProps} currentDay={5} coinBalance={100} />);
    const chip = screen.getByLabelText(/lease: 15 coins per day/i);
    // The pre-027 readout lived in a `hidden sm:flex` wrapper. Nothing in the chip's
    // ancestry may hide it below sm.
    let node: HTMLElement | null = chip;
    while (node && node !== container) {
      expect(node.className).not.toMatch(/(^|\s)hidden(\s|$)/);
      node = node.parentElement;
    }
  });
});

// The streak reads as a state, not a quantity: a flame that is either lit or not,
// sitting on the day counter it accrues against. The count and the coins it earns are
// in the tooltip, so the HUD spends no width on digits that change every day.
describe('HUD — streak flame', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** Reports `matches` only for the queries listed, so one media feature can be set. */
  function stubMedia(matching: string[]) {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: matching.some(m => query.includes(m)),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }));
  }

  function flame() {
    return screen.queryByRole('img', { name: /harvest streak/i });
  }

  it('stays unlit when there is no streak', () => {
    render(<HUD {...baseProps} currentDay={5} coinBalance={100} harvestStreak={0} />);
    expect(flame()).toBeNull();
  });

  it('lights up when a streak is live', () => {
    render(<HUD {...baseProps} currentDay={5} coinBalance={100} harvestStreak={3} />);
    expect(flame()).toBeInTheDocument();
    expect(flame()).toHaveTextContent('🔥');
  });

  it('names the streak length and what the next harvest earns', () => {
    render(<HUD {...baseProps} currentDay={5} coinBalance={100} harvestStreak={3} />);
    expect(
      screen.getByRole('img', { name: /harvest streak: 3 days in a row/i }),
    ).toBeInTheDocument();
    expect(flame()!.getAttribute('aria-label')).toMatch(/\+15 coins/);
  });

  it('caps the bonus it names at +20', () => {
    render(<HUD {...baseProps} currentDay={5} coinBalance={100} harvestStreak={7} />);
    expect(flame()!.getAttribute('aria-label')).toMatch(/\+20 coins/);
  });

  it('uses the singular "day" for a 1-day streak', () => {
    render(<HUD {...baseProps} currentDay={5} coinBalance={100} harvestStreak={1} />);
    expect(flame()!.getAttribute('aria-label')).toMatch(/1 day in a row/i);
  });

  it('shows the same detail on hover', () => {
    render(<HUD {...baseProps} currentDay={5} coinBalance={100} harvestStreak={3} />);
    expect(flame()!.getAttribute('title')).toBe(flame()!.getAttribute('aria-label'));
  });

  it('carries no visible digits — the flame alone signals the streak', () => {
    render(<HUD {...baseProps} currentDay={5} coinBalance={100} harvestStreak={3} />);
    expect(flame()!.textContent).toBe('🔥');
  });

  it('sits on the day counter, right after the day count', () => {
    render(<HUD {...baseProps} currentDay={5} coinBalance={100} harvestStreak={3} />);
    // Same line as the day count, and after it in document order.
    const line = flame()!.parentElement!;
    expect(line).toHaveTextContent(/D5\/20/);
    expect(
      line.firstElementChild!.compareDocumentPosition(flame()!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('pulses so a live streak is noticeable', () => {
    render(<HUD {...baseProps} currentDay={5} coinBalance={100} harvestStreak={3} />);
    expect(flame()!.className).toMatch(/streak-flame-anim/);
  });

  it('holds still when the player asked for reduced motion', () => {
    stubMedia(['prefers-reduced-motion']);
    render(<HUD {...baseProps} currentDay={5} coinBalance={100} harvestStreak={3} />);
    expect(flame()!.className).not.toMatch(/streak-flame-anim/);
  });

  // The scale half of the pulse must ride on the wrapper: the glyph inside carries
  // EmojiIcon's optical-lift transform, which a `transform` keyframe would clobber.
  it('animates the wrapper, not the glyph that carries the optical lift', () => {
    render(<HUD {...baseProps} currentDay={5} coinBalance={100} harvestStreak={3} />);
    const glyph = flame()!.firstElementChild!;
    expect(glyph.className).toMatch(/-translate-y-\[0\.1875em\]/);
    expect(glyph.className).not.toMatch(/streak-flame-anim/);
  });
});

describe('HUD — mobile compaction', () => {
  it('shows the short season label and the full name in the DOM', () => {
    render(<HUD {...baseProps} currentDay={1} coinBalance={100} harvestStreak={0} />);
    // short label (mobile) and full name (desktop span) both present
    expect(screen.getByText('SPRING')).toBeInTheDocument();
    expect(screen.getByText(/Season 1 · Spring Thaw/)).toBeInTheDocument();
  });

  it('toggles the season chip aria-expanded on click', () => {
    render(<HUD {...baseProps} currentDay={1} coinBalance={100} harvestStreak={0} />);
    const chip = screen.getByRole('button', { name: /season 1 · spring thaw/i });
    expect(chip).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(chip);
    expect(chip).toHaveAttribute('aria-expanded', 'true');
  });
});

function renderHUD(over: Partial<React.ComponentProps<typeof HUD>> = {}) {
  render(
    <HUD
      currentDay={1}
      coinBalance={130}
      onNextDay={vi.fn()}
      onLastTurn={vi.fn()}
      isProcessing={false}
      hasLastTurn={false}
      endlessMode={false}
      harvestStreak={0}
      canAdvanceProductively={true}
      contract={null}
      onRestart={vi.fn()}
      onReplayTutorial={vi.fn()}
      {...over}
    />,
  );
}

describe('HUD — empty-day safeguard label', () => {
  it('shows the normal Next Day label when advancing is productive', () => {
    renderHUD({ canAdvanceProductively: true });
    expect(screen.getByRole('button', { name: /advance to next day/i })).toHaveTextContent(/next day/i);
  });

  it('warns to plant first when advancing is unproductive', () => {
    renderHUD({ canAdvanceProductively: false });
    expect(screen.getByText(/skip day/i)).toBeInTheDocument();
  });

  it('labels the advance control "Skip day" when nothing is planted (017 FR-018)', () => {
    renderHUD({ canAdvanceProductively: false });
    expect(screen.getByRole('button', { name: /skip day — nothing planted/i })).toHaveTextContent(/skip day/i);
    expect(screen.queryByText(/plant seeds first/i)).toBeNull();
  });

  it('marks the next-day and balance anchors', () => {
    const { container } = render(
      <HUD currentDay={1} coinBalance={130} onNextDay={vi.fn()}
        onLastTurn={vi.fn()} isProcessing={false} hasLastTurn={false} endlessMode={false}
        harvestStreak={0} canAdvanceProductively={true} contract={null}
        onRestart={vi.fn()} onReplayTutorial={vi.fn()} />,
    );
    expect(container.querySelector('[data-onboarding="next-day"]')).toBeTruthy();
    expect(container.querySelector('[data-onboarding="balance-chip"]')).toBeTruthy();
  });
});

describe('HUD — 021 celebration anchors', () => {
  it('marks the balance chip with data-coin-target', () => {
    const { container } = render(<HUD {...baseProps} currentDay={1} coinBalance={100} />);
    expect(container.querySelector('[data-coin-target]')).not.toBeNull();
  });
});

describe('HUD — 021 held/ticking balance', () => {
  it('displays heldBalance instead of the committed balance', () => {
    render(<HUD {...baseProps} currentDay={3} coinBalance={93} heldBalance={100} />);
    const coins = screen.getByLabelText(/coins: 93/i);
    expect(coins).toHaveTextContent('100');
    expect(coins).not.toHaveTextContent('93');
  });

  it('keeps aria-label and danger styling on the committed balance while holding', () => {
    // committed 10 vs Season-1 lease 15 → critical; held value is comfortable.
    render(<HUD {...baseProps} currentDay={3} coinBalance={10} heldBalance={500} />);
    const coins = screen.getByLabelText(/coins: 10/i);
    expect(coins).toHaveTextContent('500');
    expect(coins.className).toContain('text-farm-danger'); // critical text color
  });

  it('shows the committed balance when heldBalance is null', () => {
    render(<HUD {...baseProps} currentDay={3} coinBalance={93} heldBalance={null} />);
    expect(screen.getByLabelText(/coins: 93/i)).toHaveTextContent('93');
  });
});

describe('contract chip (022)', () => {
  it('renders progress and days left while a contract is live', () => {
    renderHUD({ contract: { done: 2, total: 3, cropId: 'parsnip', daysLeft: 4 } });
    expect(screen.getByLabelText(/contract: 2 of 3 parsnip/i)).toBeInTheDocument();
    expect(screen.getByText('2/3 · 4d')).toBeInTheDocument();
  });

  it('is hidden without a contract', () => {
    renderHUD({ contract: null });
    expect(screen.queryByLabelText(/contract:/i)).toBeNull();
  });
});

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

  it('does not render the season chip as a button at sm+', () => {
    stubDesktop();
    render(<HUD {...baseProps} currentDay={1} coinBalance={100} harvestStreak={0} />);
    expect(screen.queryByRole('button', { name: /season 1 · spring thaw/i })).toBeNull();
  });

  it('still shows the season chip content at sm+', () => {
    stubDesktop();
    render(<HUD {...baseProps} currentDay={1} coinBalance={100} harvestStreak={0} />);
    expect(screen.getByText(/Season 1 · Spring Thaw/)).toBeInTheDocument();
  });
});

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

describe('HUD — late-season warning', () => {
  // The default jsdom matchMedia stub reports every query as false, i.e. narrow.
  it('appends the days-left warning after the goal caption', () => {
    render(<HUD {...baseProps} currentDay={18} coinBalance={50} />);
    const caption = screen.getByText(/goal 105.D20/i).parentElement!;
    const text = caption.textContent ?? '';
    expect(text.indexOf('days left')).toBeGreaterThan(text.indexOf('Goal'));
  });
});
