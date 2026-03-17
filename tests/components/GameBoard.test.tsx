import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { axe } from 'vitest-axe';
import { BankruptcyScreen } from '../../src/components/BankruptcyScreen';
import { GameBoard } from '../../src/components/GameBoard';
import { initialGameState } from '../../src/engine/gameEngine';
import type { DailyLogEntry } from '../../src/engine/types';

// ── T022: BankruptcyScreen smoke tests ────────────────────────────────────────

describe('BankruptcyScreen', () => {
  it('renders the days survived count', () => {
    render(
      <BankruptcyScreen daysPlayed={10} peakBalance={150} onRestart={vi.fn()} />
    );
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it('renders the peak balance', () => {
    render(
      <BankruptcyScreen daysPlayed={10} peakBalance={150} onRestart={vi.fn()} />
    );
    expect(screen.getByText(/150/)).toBeInTheDocument();
  });

  it('renders a Restart button', () => {
    render(
      <BankruptcyScreen daysPlayed={10} peakBalance={150} onRestart={vi.fn()} />
    );
    expect(
      screen.getByRole('button', { name: /restart/i })
    ).toBeInTheDocument();
  });

  it('calls onRestart when Restart button is clicked', async () => {
    const onRestart = vi.fn();
    render(
      <BankruptcyScreen daysPlayed={5} peakBalance={80} onRestart={onRestart} />
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
    getSeedPrice: () => 5,
    getNextUpgradeCost: () => 50 as number | null,
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
};

describe('GameBoard — smoke tests (T047)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders HUD with game status header', () => {
    render(<GameBoard {...makeGameBoardProps()} />);
    expect(screen.getByRole('banner', { name: /game status/i })).toBeInTheDocument();
  });

  it('renders the FarmGrid with 12 empty plot buttons', () => {
    render(<GameBoard {...makeGameBoardProps()} />);
    const plots = screen.getAllByRole('button', { name: /empty plot/i });
    expect(plots).toHaveLength(12);
  });

  it('renders the Shop panel', () => {
    render(<GameBoard {...makeGameBoardProps()} />);
    expect(screen.getByRole('complementary', { name: /shop/i })).toBeInTheDocument();
  });

  it('renders the Next Day button', () => {
    render(<GameBoard {...makeGameBoardProps()} />);
    expect(
      screen.getByRole('button', { name: /advance to next day/i })
    ).toBeInTheDocument();
  });

  it('does not render DailyLog when lastDailyLog is null (Day 1 before any turn)', () => {
    render(<GameBoard {...makeGameBoardProps({ lastDailyLog: null })} />);
    expect(
      screen.queryByRole('region', { name: /daily summary/i })
    ).not.toBeInTheDocument();
  });

  it('renders DailyLog when lastDailyLog is provided', () => {
    render(<GameBoard {...makeGameBoardProps({ lastDailyLog: sampleLog })} />);
    expect(
      screen.getByRole('region', { name: /daily summary/i })
    ).toBeInTheDocument();
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
      <BankruptcyScreen daysPlayed={7} peakBalance={120} onRestart={vi.fn()} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
