import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { ReactElement } from 'react';
import { GameBoard } from '../../src/components/GameBoard';
import { initialGameState } from '../../src/engine/gameEngine';
import { markOnboardingComplete } from '../../src/engine/onboarding';
import type { DailyLogEntry, GameState } from '../../src/engine/types';

vi.mock('../../src/audio/sfx', async importOriginal => ({
  ...(await importOriginal<typeof import('../../src/audio/sfx')>()),
  playSfx: vi.fn(),
}));
import { playSfx } from '../../src/audio/sfx';

const harvestLog: DailyLogEntry = {
  day: 3,
  weatherId: 'sunny',
  weatherMultiplier: 1,
  harvests: [{ plotId: 0, cropId: 'radish', baseYield: 12, weatherMultiplier: 1, adjustedYield: 12 }],
  totalHarvestIncome: 12,
  openingBalance: 100,
  landLeaseDeducted: 15,
  taxRate: 0.06,
  taxDeducted: 4,
  netChange: -7,
  closingBalance: 93,
  exhaustedPlots: [0],
  pestDestroyedPlots: [],
  pestPlotsAtRisk: 0,
  flashDroughtDaysAfter: 0,
  streakBefore: 0,
  streakAfter: 1,
  streakBonus: 0,
  marketActive: null,
  marketAnnounced: null,
  buildingsApplied: [],
};

const quietLog: DailyLogEntry = { ...harvestLog, harvests: [], totalHarvestIncome: 0 };

function makeProps(state?: Partial<GameState>) {
  const base = initialGameState();
  // A growing crop keeps canAdvanceProductively() true, so the Next Day click
  // advances directly (label "Advance to next day") instead of opening the
  // empty-day confirm dialog with a "Skip day" label.
  const plots = base.plots.map(p =>
    p.id === 0 ? { ...p, cropId: 'radish' as const, dayPlanted: 1, daysRemaining: 1 } : p,
  );
  return {
    state: { ...base, plots, coinBalance: 93, ...state },
    lastDailyLog: null as DailyLogEntry | null,
    onNextDay: vi.fn(),
    onPlantSeed: vi.fn().mockReturnValue(false),
    onBuySeed: vi.fn(),
    onBuyFertilizer: vi.fn(),
    onApplyFertilizer: vi.fn(),
    onClearPestDamage: vi.fn(),
    getFertilizerCount: () => 0,
    getSeedPrice: () => 5,
    seedYieldMultiplier: 1,
    onBuyPlot: vi.fn().mockReturnValue(false),
    getNextPlotPrice: () => null as number | null,
    recoveryDays: 3,
    buildingCards: [],
    onBuyBuilding: vi.fn().mockReturnValue(false),
    onRestart: vi.fn(),
  };
}

/** Click Next Day, then deliver the log — mirrors the engine round-trip. */
function advanceWithLog(
  rerender: (ui: ReactElement) => void,
  props: ReturnType<typeof makeProps>,
  log: DailyLogEntry,
) {
  fireEvent.click(screen.getAllByRole('button', { name: /next day/i })[0]);
  rerender(<GameBoard {...props} lastDailyLog={log} />);
}

class FakeAnimation {
  onfinish: (() => void) | null = null;
  cancel = vi.fn();
}

function installFakeWaapi() {
  const animations: FakeAnimation[] = [];
  HTMLElement.prototype.animate = vi.fn(() => {
    const a = new FakeAnimation();
    animations.push(a);
    return a as unknown as Animation;
  }) as unknown as typeof HTMLElement.prototype.animate;
  return animations;
}

beforeEach(() => {
  localStorage.clear();
  markOnboardingComplete();
});

afterEach(() => {
  delete (HTMLElement.prototype as { animate?: unknown }).animate;
});

describe('GameBoard — 021 harvest celebration wiring', () => {
  it('holds the pre-turn balance in the HUD while a fresh harvest summary is open', () => {
    const props = makeProps();
    const { rerender } = render(<GameBoard {...props} />);
    advanceWithLog(rerender, props, harvestLog);
    // Modal is open; HUD text shows the held opening balance, label the committed one.
    expect(screen.getByLabelText('Close day summary')).toBeInTheDocument();
    expect(screen.getByLabelText(/coins: 93/i)).toHaveTextContent('100');
  });

  it('mounts the celebration on close and shows the committed balance when done', () => {
    const animations = installFakeWaapi();
    const props = makeProps();
    const { rerender } = render(<GameBoard {...props} />);
    advanceWithLog(rerender, props, harvestLog);
    fireEvent.click(screen.getByLabelText('Close day summary'));
    expect(screen.getByTestId('harvest-celebration')).toBeInTheDocument();
    // Land every coin → celebration resolves.
    act(() => animations.forEach(a => a.onfinish?.()));
    expect(screen.queryByTestId('harvest-celebration')).toBeNull();
    expect(screen.getByLabelText(/coins: 93/i)).toHaveTextContent('93');
  });

  it('does not hold or celebrate on a quiet day', () => {
    installFakeWaapi();
    const props = makeProps();
    const { rerender } = render(<GameBoard {...props} />);
    advanceWithLog(rerender, props, quietLog);
    expect(screen.getByLabelText(/coins: 93/i)).toHaveTextContent('93');
    fireEvent.click(screen.getByLabelText('Close day summary'));
    expect(screen.queryByTestId('harvest-celebration')).toBeNull();
  });

  it('does not celebrate on a Last Turn reopen', () => {
    installFakeWaapi();
    const props = makeProps();
    render(<GameBoard {...props} lastDailyLog={harvestLog} />);
    fireEvent.click(screen.getByRole('button', { name: /view last turn summary/i }));
    expect(screen.getByLabelText(/coins: 93/i)).toHaveTextContent('93');
    fireEvent.click(screen.getByLabelText('Close day summary'));
    expect(screen.queryByTestId('harvest-celebration')).toBeNull();
  });

  it('does not hold or mount the coin flight on a season-boundary turn', () => {
    installFakeWaapi();
    const props = makeProps({ phase: 'season_passed' });
    const { rerender } = render(<GameBoard {...props} />);
    advanceWithLog(rerender, props, harvestLog);
    expect(screen.getByLabelText(/coins: 93/i)).toHaveTextContent('93');
    fireEvent.click(screen.getByLabelText('Close day summary'));
    expect(screen.queryByTestId('harvest-celebration')).toBeNull();
  });

  it('still plays the harvest chime (sound only) on a season-boundary harvest turn', () => {
    // The SeasonTransitionModal owns the stage, so there is no coin flight — but
    // the harvest sound should not be swallowed with it.
    vi.useFakeTimers();
    try {
      installFakeWaapi();
      vi.mocked(playSfx).mockClear();
      const props = makeProps({ phase: 'season_passed' });
      const { rerender } = render(<GameBoard {...props} />);
      advanceWithLog(rerender, props, harvestLog);
      expect(screen.queryByTestId('harvest-celebration')).toBeNull();
      act(() => {
        vi.advanceTimersByTime(2000); // fire the staggered launch timers
      });
      expect(playSfx).toHaveBeenCalledWith('harvest_radish');
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels a running celebration when Next Day is pressed', () => {
    installFakeWaapi(); // animations never finish on their own
    const props = makeProps();
    const { rerender } = render(<GameBoard {...props} />);
    advanceWithLog(rerender, props, harvestLog);
    fireEvent.click(screen.getByLabelText('Close day summary'));
    expect(screen.getByTestId('harvest-celebration')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /next day/i })[0]);
    expect(screen.queryByTestId('harvest-celebration')).toBeNull();
  });
});
