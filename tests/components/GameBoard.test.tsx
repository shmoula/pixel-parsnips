import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { axe } from 'vitest-axe';
import { BankruptcyScreen } from '../../src/components/BankruptcyScreen';
import { GameBoard } from '../../src/components/GameBoard';
import { PlotCard } from '../../src/components/PlotCard';
import { initialGameState } from '../../src/engine/gameEngine';
import { markOnboardingComplete } from '../../src/engine/onboarding';
import type { DailyLogEntry, PlotState } from '../../src/engine/types';
import type { PersonalBests } from '../../src/engine/records';

const emptyRecords: PersonalBests = {
  schemaVersion: 2,
  bestDaysSurvived: 0,
  bestPeakBalance: 0,
  bestSeasonReached: 0,
  mostDisastersSurvived: 0,
  bestHarvestStreak: 0,
  totalRunsCompleted: 0,
};

const sharedBankruptcyProps = {
  disastersSurvived: 0,
  seasonReached: 1,
  medal: 'none' as const,
  records: emptyRecords,
  newBests: new Set<keyof PersonalBests>(),
};

// ── T022: BankruptcyScreen smoke tests ────────────────────────────────────────

describe('BankruptcyScreen', () => {
  it('renders the days survived count', () => {
    render(
      <BankruptcyScreen {...sharedBankruptcyProps} daysPlayed={10} peakBalance={150} onRestart={vi.fn()} />
    );
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it('renders the peak balance', () => {
    render(
      <BankruptcyScreen {...sharedBankruptcyProps} daysPlayed={10} peakBalance={150} onRestart={vi.fn()} />
    );
    expect(screen.getByText(/150/)).toBeInTheDocument();
  });

  it('renders a Restart button', () => {
    render(
      <BankruptcyScreen {...sharedBankruptcyProps} daysPlayed={10} peakBalance={150} onRestart={vi.fn()} />
    );
    expect(
      screen.getByRole('button', { name: /restart/i })
    ).toBeInTheDocument();
  });

  it('calls onRestart when Restart button is clicked', async () => {
    const onRestart = vi.fn();
    render(
      <BankruptcyScreen {...sharedBankruptcyProps} daysPlayed={5} peakBalance={80} onRestart={onRestart} />
    );
    screen.getByRole('button', { name: /restart/i }).click();
    expect(onRestart).toHaveBeenCalledTimes(1);
  });
});

// ── T047: GameBoard smoke tests + WCAG 2.1 AA gate ───────────────────────────

function makeGameBoardProps(overrides: { lastDailyLog?: DailyLogEntry | null } = {}) {
  return {
    state: initialGameState(),
    lastDailyLog: overrides.lastDailyLog ?? null,
    onNextDay: vi.fn(),
    onPlantSeed: vi.fn().mockReturnValue(false),
    onBuySeed: vi.fn(),
    onBuyUpgrade: vi.fn(),
    onBuyFertilizer: vi.fn(),
    onApplyFertilizer: vi.fn(),
    onClearPestDamage: vi.fn(),
    getFertilizerCount: () => 0,
    getSeedPrice: () => 5,
    getNextUpgradeCost: () => 50 as number | null,
    onBuyPlot: vi.fn().mockReturnValue(false),
    getNextPlotPrice: () => null as number | null,
  };
}

const sampleLog: DailyLogEntry = {
  day: 1,
  weatherId: 'sunny',
  weatherMultiplier: 1.0,
  openingBalance: 100,
  harvests: [],
  totalHarvestIncome: 0,
  landLeaseDeducted: 15,
  taxDeducted: 4,
  taxRate: 0.05,
  netChange: -19,
  closingBalance: 81,
  exhaustedPlots: [],
  pestDestroyedPlots: [],
  flashDroughtDaysAfter: 0,
};

describe('GameBoard — smoke tests (T047)', () => {
  beforeEach(() => {
    localStorage.clear();
    markOnboardingComplete();
  });

  it('renders HUD with game status header', () => {
    render(<GameBoard {...makeGameBoardProps()} />);
    expect(screen.getByRole('banner', { name: /game status/i })).toBeInTheDocument();
  });

  it('renders the FarmGrid with 4 empty plot buttons (STARTING_PLOTS=4)', () => {
    render(<GameBoard {...makeGameBoardProps()} />);
    const plots = screen.getAllByRole('button', { name: /empty plot/i });
    expect(plots).toHaveLength(4);
  });

  it('renders the Shop panel', () => {
    render(<GameBoard {...makeGameBoardProps()} />);
    expect(screen.getByRole('complementary', { name: /shop/i })).toBeInTheDocument();
  });

  it('does not render DaySummaryModal on initial load (modal is closed)', () => {
    render(<GameBoard {...makeGameBoardProps({ lastDailyLog: null })} />);
    // Modal only opens after a turn — sidebar DailyLog was removed in Phase 4 (T012)
    expect(
      screen.queryByRole('region', { name: /daily summary/i })
    ).not.toBeInTheDocument();
  });

  it('"Last Turn" button is disabled when lastDailyLog is null', () => {
    render(<GameBoard {...makeGameBoardProps({ lastDailyLog: null })} />);
    expect(
      screen.getByRole('button', { name: /last turn/i })
    ).toBeDisabled();
  });

  it('"Last Turn" button is enabled when lastDailyLog is provided', () => {
    render(<GameBoard {...makeGameBoardProps({ lastDailyLog: sampleLog })} />);
    expect(
      screen.getByRole('button', { name: /last turn/i })
    ).not.toBeDisabled();
  });

  it('"Next Day" button is rendered in both HUD and bottom bar, enabled initially', () => {
    render(<GameBoard {...makeGameBoardProps()} />);
    // Nothing planted → both copies show the empty-day safeguard label.
    const buttons = screen.getAllByRole('button', { name: /plant seeds first/i });
    expect(buttons).toHaveLength(2);
    buttons.forEach(b => expect(b).not.toBeDisabled());
  });

  it('hides the bottom action bar while the mobile shop sheet is open', () => {
    render(<GameBoard {...makeGameBoardProps()} />);
    // Bar present initially: its Shop control + its Next Day copy (alongside the HUD copy).
    expect(screen.getByRole('button', { name: /open shop/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /plant seeds first/i })).toHaveLength(2);

    // Open the mobile shop bottom sheet via the bar's Shop button.
    fireEvent.click(screen.getByRole('button', { name: /open shop/i }));

    // Bar unmounts so it can't overlay the sheet; only the HUD's (DOM-only) Next Day copy remains.
    expect(screen.queryByRole('button', { name: /open shop/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /plant seeds first/i })).toHaveLength(1);
  });

  it('passes WCAG 2.1 AA axe check — Day 1 (no log)', async () => {
    const { container } = render(<GameBoard {...makeGameBoardProps()} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('passes WCAG 2.1 AA axe check — with DailyLog', async () => {
    const { container } = render(
      <GameBoard {...makeGameBoardProps({ lastDailyLog: sampleLog })} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('passes WCAG 2.1 AA axe check — BankruptcyScreen', async () => {
    const { container } = render(
      <BankruptcyScreen {...sharedBankruptcyProps} daysPlayed={7} peakBalance={120} onRestart={vi.fn()} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ── T019: PlotCard countdown render tests (US3) ───────────────────────────────

function makeExhaustedPlot(id: number, exhaustedSinceDay: number): PlotState {
  return {
    id,
    cropId: null,
    dayPlanted: null,
    daysRemaining: null,
    consecutiveHarvests: 0,
    exhaustedSinceDay,
  };
}

// ── T022: FR-014 — consecutiveHarvests must never appear in the DOM ───────────

describe('PlotCard — FR-014: consecutiveHarvests never rendered (T022)', () => {
  const cases: Array<{ label: string; plot: PlotState }> = [
    {
      label: 'empty plot',
      plot: { id: 0, cropId: null, dayPlanted: null, daysRemaining: null, consecutiveHarvests: 0, exhaustedSinceDay: null },
    },
    {
      label: 'plot with 1 consecutive harvest',
      plot: { id: 0, cropId: null, dayPlanted: null, daysRemaining: null, consecutiveHarvests: 1, exhaustedSinceDay: null },
    },
    {
      label: 'plot with 2 consecutive harvests',
      plot: { id: 0, cropId: null, dayPlanted: null, daysRemaining: null, consecutiveHarvests: 2, exhaustedSinceDay: null },
    },
    {
      label: 'exhausted plot',
      plot: { id: 0, cropId: null, dayPlanted: null, daysRemaining: null, consecutiveHarvests: 0, exhaustedSinceDay: 5 },
    },
  ];

  cases.forEach(({ label, plot }) => {
    it(`does not render consecutiveHarvests value for ${label}`, () => {
      render(<PlotCard plot={plot} currentDay={5} />);
      // The raw consecutiveHarvests number must never appear as text
      expect(document.body.textContent).not.toMatch(String(plot.consecutiveHarvests));
    });
  });
});

// ── T023/T024: WCAG axe check with exhausted plot (fertilizer aria) ───────────

describe('GameBoard — WCAG with exhausted plot (T023/T024)', () => {
  beforeEach(() => {
    localStorage.clear();
    markOnboardingComplete();
  });

  it('passes WCAG 2.1 AA axe check — GameBoard with exhausted plot', async () => {
    const exhaustedState = {
      ...initialGameState(),
      plots: initialGameState().plots.map((p, i) =>
        i === 0 ? { ...p, exhaustedSinceDay: 3, consecutiveHarvests: 0 } : p
      ),
    };
    const props = {
      ...makeGameBoardProps(),
      state: exhaustedState,
      getFertilizerCount: () => 1,
    };
    const { container } = render(<GameBoard {...props} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ── T027: FR-010 Flash Drought banner + FR-018 drought icon smoke tests ────────

describe('GameBoard — Flash Drought banner (T027, FR-010)', () => {
  beforeEach(() => {
    localStorage.clear();
    markOnboardingComplete();
  });

  it('renders Flash Drought banner when flashDroughtDaysRemaining > 0', () => {
    const droughtState = { ...initialGameState(), flashDroughtDaysRemaining: 2 };
    render(<GameBoard {...makeGameBoardProps()} state={droughtState} />);
    expect(screen.getByRole('alert', { name: /flash drought warning/i })).toBeInTheDocument();
  });

  it('does NOT render Flash Drought banner when flashDroughtDaysRemaining === 0', () => {
    render(<GameBoard {...makeGameBoardProps()} />);
    expect(screen.queryByRole('alert', { name: /flash drought warning/i })).not.toBeInTheDocument();
  });

  it('shows remaining day count in banner', () => {
    const droughtState = { ...initialGameState(), flashDroughtDaysRemaining: 1 };
    render(<GameBoard {...makeGameBoardProps()} state={droughtState} />);
    expect(screen.getByRole('alert', { name: /flash drought warning/i })).toHaveTextContent('1 day');
  });
});

describe('PlotCard — drought icon (T027, FR-018)', () => {
  it('renders drought icon when plot.droughtPenalised is true', () => {
    const droughtPlot: PlotState = {
      id: 0, cropId: 'radish', dayPlanted: 1, daysRemaining: 2,
      consecutiveHarvests: 0, exhaustedSinceDay: null,
      pestDamaged: false, droughtPenalised: true,
    };
    render(<PlotCard plot={droughtPlot} currentDay={1} />);
    expect(screen.getByTitle('Growth slowed by Flash Drought')).toBeInTheDocument();
  });

  it('does NOT render drought icon when plot.droughtPenalised is false', () => {
    const normalPlot: PlotState = {
      id: 0, cropId: 'radish', dayPlanted: 1, daysRemaining: 1,
      consecutiveHarvests: 0, exhaustedSinceDay: null,
      pestDamaged: false, droughtPenalised: false,
    };
    render(<PlotCard plot={normalPlot} currentDay={1} />);
    expect(screen.queryByTitle('Growth slowed by Flash Drought')).not.toBeInTheDocument();
  });
});

// ── T019: PlotCard countdown render tests (US3) ───────────────────────────────

describe('PlotCard — exhaustion countdown (T019, US3)', () => {
  it('renders "3 days remaining" when exhausted this turn (N=3)', () => {
    // exhaustedSinceDay=5, currentDay=5 → 3 - (5-5) = 3
    render(<PlotCard plot={makeExhaustedPlot(0, 5)} currentDay={5} />);
    expect(screen.getByText(/3d remaining/i)).toBeInTheDocument();
  });

  it('renders "2 days remaining" after 1 day has passed (N=2)', () => {
    // exhaustedSinceDay=5, currentDay=6 → 3 - (6-5) = 2
    render(<PlotCard plot={makeExhaustedPlot(0, 5)} currentDay={6} />);
    expect(screen.getByText(/2d remaining/i)).toBeInTheDocument();
  });

  it('renders "1 day remaining" after 2 days have passed (N=1)', () => {
    // exhaustedSinceDay=5, currentDay=7 → 3 - (7-5) = 1
    render(<PlotCard plot={makeExhaustedPlot(0, 5)} currentDay={7} />);
    expect(screen.getByText(/1d remaining/i)).toBeInTheDocument();
  });

  it('does NOT render any countdown when plot is not exhausted', () => {
    const emptyPlot: PlotState = {
      id: 0, cropId: null, dayPlanted: null, daysRemaining: null,
      consecutiveHarvests: 0, exhaustedSinceDay: null,
    };
    render(<PlotCard plot={emptyPlot} currentDay={5} />);
    expect(screen.queryByText(/remaining/i)).not.toBeInTheDocument();
  });
});
