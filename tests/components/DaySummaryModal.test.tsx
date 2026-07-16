import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { DaySummaryModal } from '../../src/components/DaySummaryModal';
import type { DailyLogEntry } from '../../src/engine/types';

function makeLog(over: Partial<DailyLogEntry> = {}): DailyLogEntry {
  return {
    day: 14,
    weatherId: 'blight',
    weatherMultiplier: 0.1,
    harvests: [],
    totalHarvestIncome: 0,
    openingBalance: 100,
    landLeaseDeducted: 15,
    taxRate: 0.05,
    taxDeducted: 4,
    netChange: -19,
    closingBalance: 81,
    exhaustedPlots: [],
    pestDestroyedPlots: [],
    flashDroughtDaysAfter: 0,
    streakBefore: 0,
    streakAfter: 0,
    streakBonus: 0,
    marketActive: null,
    marketAnnounced: null,
    ...over,
  };
}

describe('DaySummaryModal — staged disaster reveal', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('hides the disaster banner + badge until the beat fires (animateReveal=true)', () => {
    render(<DaySummaryModal log={makeLog()} onClose={() => {}} animateReveal />);

    // Before the timer: no disaster banner, no "Disaster!" badge.
    expect(screen.queryByLabelText(/^disaster$/i)).toBeNull();
    expect(screen.queryByText(/^Disaster!$/i)).toBeNull();

    // After the beat: both appear.
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(screen.getByLabelText(/^disaster$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Disaster!$/i)).toBeInTheDocument();
  });

  it('shows the disaster banner immediately on reopen (animateReveal=false)', () => {
    render(<DaySummaryModal log={makeLog()} onClose={() => {}} animateReveal={false} />);
    expect(screen.getByLabelText(/^disaster$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Disaster!$/i)).toBeInTheDocument();
  });

  it('does not stage on a non-disaster day', () => {
    render(
      <DaySummaryModal
        log={makeLog({ weatherId: 'sunny', weatherMultiplier: 1 })}
        onClose={() => {}}
        animateReveal
      />,
    );
    // No banner ever, before or after any timer.
    expect(screen.queryByLabelText(/^disaster$/i)).toBeNull();
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(screen.queryByLabelText(/^disaster$/i)).toBeNull();
  });
});

describe('DaySummaryModal — reduced motion', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.matchMedia = (query: string) =>
      ({
        matches: true, // prefers reduced motion
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList;
  });
  afterEach(() => {
    vi.useRealTimers();
    // restore the default no-preference stub
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList;
  });

  it('reveals immediately when reduced motion is preferred', () => {
    render(<DaySummaryModal log={makeLog()} onClose={() => {}} animateReveal />);
    expect(screen.getByLabelText(/^disaster$/i)).toBeInTheDocument();
  });
});

describe('DaySummaryModal — quiet-day framing (017 FR-020)', () => {
  it('suppresses "Quiet day" when the day was a disaster', () => {
    render(
      <DaySummaryModal
        log={makeLog({ weatherId: 'pest_infestation', harvests: [], totalHarvestIncome: 0 })}
        onClose={() => {}}
        animateReveal={false}
      />,
    );
    expect(screen.queryByText(/quiet day/i)).toBeNull();
  });

  it('still shows "Quiet day" on ordinary no-harvest days', () => {
    render(
      <DaySummaryModal
        log={makeLog({ weatherId: 'overcast', harvests: [], totalHarvestIncome: 0 })}
        onClose={() => {}}
        animateReveal={false}
      />,
    );
    expect(screen.getByText(/quiet day — no harvests/i)).toBeInTheDocument();
  });
});

// Emoji sitting inline with Press Start 2P text must be lifted onto the text's
// optical centre with <EmojiIcon> — see DailyLog.test.tsx for the metrics.
describe('DaySummaryModal — inline icons are optically centred', () => {
  it('lifts the Disaster! badge icon', () => {
    render(<DaySummaryModal log={makeLog()} onClose={() => {}} animateReveal={false} />);
    const icon = screen.getByText('⚠️');
    expect(icon.className).toContain('-translate-y-[0.1875em]');
    expect(icon.className).toContain('inline-block');
  });
});
