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
