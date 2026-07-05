import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { axe } from 'vitest-axe';
import { BankruptcyScreen } from '../../src/components/BankruptcyScreen';
import { GameBoard } from '../../src/components/GameBoard';
import { PlotCard } from '../../src/components/PlotCard';
import { initialGameState } from '../../src/engine/gameEngine';
import { markOnboardingComplete, saveOnboarding } from '../../src/engine/onboarding';
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

function makeGameBoardProps(overrides: { lastDailyLog?: DailyLogEntry | null; onRestart?: () => void } = {}) {
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
    onRestart: overrides.onRestart ?? vi.fn(),
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
    const buttons = screen.getAllByRole('button', { name: /skip day/i });
    expect(buttons).toHaveLength(2);
    buttons.forEach(b => expect(b).not.toBeDisabled());
  });

  it('hides the bottom action bar while the mobile shop sheet is open', () => {
    render(<GameBoard {...makeGameBoardProps()} />);
    // Bar present initially: its Shop control + its Next Day copy (alongside the HUD copy).
    expect(screen.getByRole('button', { name: /open shop/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /skip day/i })).toHaveLength(2);

    // Open the mobile shop bottom sheet via the bar's Shop button.
    fireEvent.click(screen.getByRole('button', { name: /open shop/i }));

    // Bar unmounts so it can't overlay the sheet; only the HUD's (DOM-only) Next Day copy remains.
    expect(screen.queryByRole('button', { name: /open shop/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /skip day/i })).toHaveLength(1);
  });

  it('closes the mobile shop sheet when onboarding advances to the plant step', () => {
    // Active tutorial sitting on buy-radishes; nothing planted, no radishes yet.
    saveOnboarding({ schemaVersion: 1, completed: false, step: 'buy-radishes' });
    const props = makeGameBoardProps();
    const empty = initialGameState();
    const { rerender } = render(<GameBoard {...props} state={empty} />);

    // Open the mobile shop sheet → the bar (with the Open shop control) hides.
    fireEvent.click(screen.getByRole('button', { name: /open shop/i }));
    expect(screen.queryByRole('button', { name: /open shop/i })).not.toBeInTheDocument();

    // Player now holds enough radishes → onboarding derives the 'plant' step.
    const withRadishes = {
      ...empty,
      seedInventory: { ...empty.seedInventory, radish: empty.unlockedPlots },
    };
    rerender(<GameBoard {...props} state={withRadishes} />);

    // Shop auto-closes so the (previously covered) farm grid is reachable: bar returns.
    expect(screen.getByRole('button', { name: /open shop/i })).toBeInTheDocument();
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
      // The raw consecutiveHarvests number must never appear as text (word-boundary
      // match so incidental digits inside unrelated numbers, e.g. a fertilizer
      // price, don't produce a false positive)
      const boundaryPattern = new RegExp(`\\b${plot.consecutiveHarvests}\\b`);
      expect(document.body.textContent).not.toMatch(boundaryPattern);
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

// ── Task 10: EmptyDayConfirm — costed copy + ruinous re-arm (FR-015/FR-016) ──

describe('GameBoard — empty-day guardrails (017 FR-015/FR-016)', () => {
  beforeEach(() => {
    localStorage.clear();
    markOnboardingComplete();
  });

  it('states the concrete cost of an empty day in the confirmation', () => {
    // Season 1 (day 3): lease 15; balance 100 → tax = floor((100−15)×0.06) = 5
    render(
      <GameBoard
        {...makeGameBoardProps()}
        state={{ ...initialGameState(), currentDay: 3, coinBalance: 100 }}
      />
    );
    fireEvent.click(screen.getAllByRole('button', { name: /skip day/i })[0]);
    const dialog = screen.getByRole('dialog', { name: /advance empty day/i });
    expect(dialog).toHaveTextContent(/15🪙 lease/i);
    expect(dialog).toHaveTextContent(/~5🪙 tax/i);
    expect(dialog).toHaveTextContent(/earn nothing/i);
  });

  it('re-arms the confirmation when another empty day could not be survived', () => {
    // balance 29, lease 15, tax = floor((29−15)×0.06) = 0 → after: 14; 14 < 15 → RUINOUS
    const props = makeGameBoardProps();
    const day3State = { ...initialGameState(), currentDay: 3, coinBalance: 29 };
    const { rerender } = render(<GameBoard {...props} state={day3State} />);

    fireEvent.click(screen.getAllByRole('button', { name: /skip day/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /^skip day$/i })); // confirm the first empty day

    // Simulate the parent applying onNextDay()'s effect: balance drops by lease
    // (tax is 0 here), day advances — exactly the "ruinous" state FR-016 targets.
    // A fresh lastDailyLog is required too: GameBoard only clears its internal
    // isProcessing flag (and reopens for a new confirm) once it observes a new log.
    const day4State = { ...day3State, currentDay: 4, coinBalance: 14 };
    rerender(
      <GameBoard {...props} state={day4State} lastDailyLog={{ ...sampleLog, day: 3, closingBalance: 14 }} />
    );

    fireEvent.click(screen.getAllByRole('button', { name: /skip day/i })[0]); // attempt a second
    expect(screen.getByRole('dialog', { name: /advance empty day/i })).toBeInTheDocument();
  });

  it('re-arms across a season boundary where tomorrow\'s lease is higher than today\'s (regression)', () => {
    // Day 20 = last day of Spring Thaw (lease 15); day 21 starts Summer Heat (lease 22).
    // On day 20 with balance 30: tax = floor((30−15)×0.06) = 0 → remaining 15.
    // Against TODAY's lease (15), 15 < 15 is false — looks fine (the old, buggy check
    // that compared against today's own lease instead of tomorrow's).
    // Against TOMORROW's lease (22, the day-21 season-boundary jump), 15 < 22 is
    // true — genuinely ruinous (the fix), since the incoming higher lease would
    // leave the player unable to cover it.
    const props = makeGameBoardProps();
    const day19State = { ...initialGameState(), currentDay: 19, coinBalance: 45 };
    const { rerender } = render(<GameBoard {...props} state={day19State} />);

    // Confirm the first empty day on day 19 to arm `hasConfirmedEmptyDay`.
    fireEvent.click(screen.getAllByRole('button', { name: /skip day/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /^skip day$/i }));

    // Simulate the parent applying onNextDay()'s effect: day advances to 20,
    // balance lands at 30 (the ruinous-vs-tomorrow's-lease value computed above).
    const day20State = { ...day19State, currentDay: 20, coinBalance: 30 };
    rerender(
      <GameBoard {...props} state={day20State} lastDailyLog={{ ...sampleLog, day: 19, closingBalance: 30 }} />
    );

    // Attempt a second empty day on day 20 — the ruinous check must look ahead to
    // day 21's higher lease, not day 20's own (unchanged) lease.
    fireEvent.click(screen.getAllByRole('button', { name: /skip day/i })[0]);
    expect(screen.getByRole('dialog', { name: /advance empty day/i })).toBeInTheDocument();
  });
});

// ── Task 11: UnwinnableBanner — no seeds, none owned, nothing growing (FR-017) ──

describe('GameBoard — unwinnable-run notice (017 FR-017)', () => {
  beforeEach(() => {
    localStorage.clear();
    markOnboardingComplete();
  });

  it('warns when no seeds are affordable, none owned, and nothing grows', () => {
    render(
      <GameBoard {...makeGameBoardProps()} state={{ ...initialGameState(), coinBalance: 3 }} />
    );
    const alert = screen.getByRole('alert', { name: /run cannot recover/i });
    expect(alert).toHaveTextContent(/can't afford seeds/i);
    expect(within(alert).getByRole('button', { name: /start new run/i })).toBeInTheDocument();
  });

  it('does not fire while a crop is still growing', () => {
    const growingState = {
      ...initialGameState(),
      coinBalance: 3,
      plots: initialGameState().plots.map((p, i) =>
        i === 0 ? { ...p, cropId: 'radish' as const, dayPlanted: 1, daysRemaining: 1 } : p
      ),
    };
    render(<GameBoard {...makeGameBoardProps()} state={growingState} />);
    expect(screen.queryByRole('alert', { name: /run cannot recover/i })).not.toBeInTheDocument();
  });

  it('does not fire while the player still owns a seed', () => {
    const seededState = {
      ...initialGameState(),
      coinBalance: 3,
      seedInventory: { ...initialGameState().seedInventory, radish: 1 },
    };
    render(<GameBoard {...makeGameBoardProps()} state={seededState} />);
    expect(screen.queryByRole('alert', { name: /run cannot recover/i })).not.toBeInTheDocument();
  });

  it('does not fire when the balance can still afford the cheapest seed', () => {
    render(
      <GameBoard {...makeGameBoardProps()} state={{ ...initialGameState(), coinBalance: 100 }} />
    );
    expect(screen.queryByRole('alert', { name: /run cannot recover/i })).not.toBeInTheDocument();
  });

  it('requires a second tap to restart', () => {
    const onRestart = vi.fn();
    render(
      <GameBoard
        {...makeGameBoardProps({ onRestart })}
        state={{ ...initialGameState(), coinBalance: 3 }}
      />
    );
    const btn = screen.getByRole('button', { name: /start new run/i });
    fireEvent.click(btn);
    expect(onRestart).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /tap again to confirm/i }));
    expect(onRestart).toHaveBeenCalledOnce();
  });
});

// ── Task 15: Shop sheet — explicit open/close instead of toggle (017 FR-004) ──

describe('GameBoard — shop sheet open/close semantics (017 FR-004)', () => {
  beforeEach(() => {
    localStorage.clear();
    markOnboardingComplete();
  });

  it('shop button opens (never closes) the sheet — double taps are safe (017 FR-004)', () => {
    render(<GameBoard {...makeGameBoardProps()} />);
    const shopBtn = screen.getByRole('button', { name: /open shop/i });
    fireEvent.click(shopBtn);
    fireEvent.click(shopBtn); // second (ghost) tap must not close it
    // The sheet wrapper is open when it lacks the translate-y-full class
    const sheet = screen.getByRole('complementary', { name: /shop/i }).parentElement as HTMLElement;
    expect(sheet.className).not.toContain('translate-y-full');
  });
});

// ── Task 12: Empty-plot tap always responds (FR-014) ──────────────────────────

describe('GameBoard — empty-plot tap feedback (017 FR-014)', () => {
  beforeEach(() => {
    localStorage.clear();
    markOnboardingComplete();
  });

  it('guides toward the shop when the player owns no seeds', () => {
    render(<GameBoard {...makeGameBoardProps()} state={initialGameState()} />);
    fireEvent.click(screen.getByRole('button', { name: /empty plot 1/i }));
    expect(screen.getByRole('status')).toHaveTextContent(/you need seeds — grab some in the shop/i);
  });

  it('prompts seed selection when seeds are owned but none selected', () => {
    const seededState = {
      ...initialGameState(),
      seedInventory: { radish: 2, parsnip: 0, pumpkin: 0 },
    };
    render(<GameBoard {...makeGameBoardProps()} state={seededState} />);
    fireEvent.click(screen.getByRole('button', { name: /empty plot 1/i }));
    expect(screen.getByRole('status')).toHaveTextContent(/pick a seed first/i);
  });
});

// ── T019: PlotCard countdown render tests (US3) ───────────────────────────────

describe('PlotCard — exhaustion countdown (T019, US3)', () => {
  it('renders "3 days remaining" when exhausted this turn (N=3)', () => {
    // exhaustedSinceDay=5, currentDay=5 → 3 - (5-5) = 3
    render(<PlotCard plot={makeExhaustedPlot(0, 5)} currentDay={5} />);
    expect(screen.getByText(/resting · 3d/i)).toBeInTheDocument();
  });

  it('renders "2 days remaining" after 1 day has passed (N=2)', () => {
    // exhaustedSinceDay=5, currentDay=6 → 3 - (6-5) = 2
    render(<PlotCard plot={makeExhaustedPlot(0, 5)} currentDay={6} />);
    expect(screen.getByText(/resting · 2d/i)).toBeInTheDocument();
  });

  it('renders "1 day remaining" after 2 days have passed (N=1)', () => {
    // exhaustedSinceDay=5, currentDay=7 → 3 - (7-5) = 1
    render(<PlotCard plot={makeExhaustedPlot(0, 5)} currentDay={7} />);
    expect(screen.getByText(/ready tomorrow/i)).toBeInTheDocument();
  });

  it('does NOT render any countdown when plot is not exhausted', () => {
    const emptyPlot: PlotState = {
      id: 0, cropId: null, dayPlanted: null, daysRemaining: null,
      consecutiveHarvests: 0, exhaustedSinceDay: null,
    };
    render(<PlotCard plot={emptyPlot} currentDay={5} />);
    expect(screen.queryByText(/resting|ready tomorrow/i)).not.toBeInTheDocument();
  });
});
