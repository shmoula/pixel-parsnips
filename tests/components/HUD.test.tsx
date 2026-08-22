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

describe('HUD — harvest streak chip', () => {
  it('hides the streak chip when harvestStreak === 0', () => {
    render(<HUD {...baseProps} currentDay={5} coinBalance={100} harvestStreak={0} />);
    expect(screen.queryByLabelText(/harvest streak/i)).toBeNull();
  });

  it('shows the streak chip with ×N when harvestStreak > 0', () => {
    render(<HUD {...baseProps} currentDay={5} coinBalance={100} harvestStreak={7} />);
    const chip = screen.getByLabelText(/harvest streak/i);
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent('×7');
    // Tooltip reflects the capped next-bonus (streak 7 → bonus capped at +20).
    expect(chip).toHaveAttribute(
      'title',
      'Harvest streak: 7 days in a row. Next harvest earns +20🪙 bonus (capped at +20).',
    );
  });
});

describe('HUD — reputation chip', () => {
  it('shows "Struggling Smallholder" on Day 1', () => {
    render(<HUD {...baseProps} currentDay={1} coinBalance={100} />);
    const chip = screen.getByLabelText(/reputation/i);
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent(/Struggling Smallholder/i);
  });

  it('shows "Seasoned Grower" on Day 14', () => {
    render(<HUD {...baseProps} currentDay={14} coinBalance={100} />);
    expect(screen.getByLabelText(/reputation/i)).toHaveTextContent(/Seasoned Grower/i);
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

  it('toggles the reputation chip aria-expanded on click', () => {
    render(<HUD {...baseProps} currentDay={1} coinBalance={100} harvestStreak={0} />);
    const chip = screen.getByRole('button', { name: /reputation/i });
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
        harvestStreak={0} canAdvanceProductively={true} contract={null} />,
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
    expect(coins.className).toContain('text-[#EB6A5C]'); // critical text color
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
