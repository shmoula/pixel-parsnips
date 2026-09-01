import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { BankruptcyScreen } from '../../src/components/BankruptcyScreen';
import { MEDAL_LABELS } from '../../src/engine/medals';
import type { PersonalBests } from '../../src/engine/records';
import type { RunDayRecord } from '../../src/engine/types';

const emptyRecords: PersonalBests = {
  schemaVersion: 2,
  bestDaysSurvived: 0,
  bestPeakBalance: 0,
  bestSeasonReached: 0,
  mostDisastersSurvived: 0,
  bestHarvestStreak: 0,
  totalRunsCompleted: 0,
};

function renderScreen(props: Partial<React.ComponentProps<typeof BankruptcyScreen>> = {}) {
  return render(
    <BankruptcyScreen
      daysPlayed={12}
      peakBalance={150}
      peakHarvestStreak={3}
      disastersSurvived={1}
      seasonReached={1}
      medal="none"
      records={emptyRecords}
      newBests={new Set()}
      onRestart={vi.fn()}
      onReplayTutorial={vi.fn()}
      showEventsUnlockTease={false}
      runHistory={[]}
      deathCause="out_of_seed_money"
      {...props}
    />,
  );
}

describe('BankruptcyScreen — enriched recap (007)', () => {
  it('renders the existing Season-reached and Peak-balance lines', () => {
    renderScreen({ daysPlayed: 12, seasonReached: 1 });
    expect(screen.getByText(/Season reached/i)).toBeInTheDocument();
    expect(screen.getByText(/Spring Thaw/i)).toBeInTheDocument();
  });

  it.each(['none', 'bronze', 'silver', 'gold', 'platinum'] as const)(
    'renders %s medal',
    (medal) => {
      renderScreen({ medal });
      expect(
        screen.getByRole('img', { name: new RegExp(MEDAL_LABELS[medal], 'i') }),
      ).toBeInTheDocument();
    },
  );

  it('shows the disasters-survived stat', () => {
    renderScreen({ disastersSurvived: 4 });
    expect(screen.getByText(/Disasters Survived/i)).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('shows a "new personal best" badge on each stat in newBests', () => {
    renderScreen({
      newBests: new Set(['bestDaysSurvived', 'bestPeakBalance']),
    });
    const badges = screen.getAllByLabelText('new personal best');
    expect(badges.length).toBe(2);
  });

  it('shows the first-run message when totalRunsCompleted === 0', () => {
    renderScreen({ records: { ...emptyRecords, totalRunsCompleted: 0 } });
    expect(screen.getByText(/first run/i)).toBeInTheDocument();
  });

  it('omits the first-run message after the first recorded run', () => {
    renderScreen({ records: { ...emptyRecords, totalRunsCompleted: 5 } });
    expect(screen.queryByText(/first run/i)).not.toBeInTheDocument();
  });

  it('renders Personal Records summary values', () => {
    renderScreen({
      records: {
        schemaVersion: 2,
        bestDaysSurvived: 42,
        bestPeakBalance: 500,
        bestSeasonReached: 3,
        mostDisastersSurvived: 6,
        bestHarvestStreak: 0,
        totalRunsCompleted: 3,
      },
    });
    expect(screen.getByText(/Personal Records/i)).toBeInTheDocument();
    expect(screen.getByText(/42/)).toBeInTheDocument();
    expect(screen.getByText(/500/)).toBeInTheDocument();
  });

  it('passes axe accessibility checks for all medal tiers', async () => {
    for (const m of ['none', 'bronze', 'silver', 'gold', 'platinum'] as const) {
      const { container, unmount } = renderScreen({ medal: m });
      const results = await axe(container);
      expect(results).toHaveNoViolations();
      unmount();
    }
  });
});

describe('BankruptcyScreen — harvest streak (008)', () => {
  it('shows Longest streak stat row with peakHarvestStreak', () => {
    renderScreen({
      peakHarvestStreak: 6,
      records: { ...emptyRecords, totalRunsCompleted: 2, bestHarvestStreak: 6 },
      newBests: new Set(['bestHarvestStreak']),
    });
    // .bg-farm-ink is the whole StatRow card; the badge now lives on its own line within it.
    const streakRow = screen.getByText('Longest streak').closest('.bg-farm-ink')!;
    expect(streakRow).toHaveTextContent('6');
    expect(within(streakRow).getByLabelText(/new personal best/i)).toBeInTheDocument();
    expect(screen.getByText(/Best streak/i)).toBeInTheDocument();
  });
});

describe('BankruptcyScreen — replay tutorial (014)', () => {
  function renderWithReplay(over: Partial<React.ComponentProps<typeof BankruptcyScreen>> = {}) {
    render(
      <BankruptcyScreen
        daysPlayed={3} peakBalance={100} peakHarvestStreak={0} disastersSurvived={0}
        seasonReached={1} medal="none"
        records={{ schemaVersion: 2, bestDaysSurvived: 0, bestPeakBalance: 0, bestSeasonReached: 0, mostDisastersSurvived: 0, bestHarvestStreak: 0, totalRunsCompleted: 1 }}
        newBests={new Set()} lastDailyLog={null}
        onRestart={vi.fn()} onReplayTutorial={vi.fn()}
        runHistory={[]} deathCause="out_of_seed_money"
        {...over}
      />,
    );
  }

  it('renders a Replay tutorial button', () => {
    renderWithReplay();
    expect(screen.getByRole('button', { name: /replay tutorial/i })).toBeInTheDocument();
  });

  it('fires onReplayTutorial when clicked', () => {
    const onReplayTutorial = vi.fn();
    renderWithReplay({ onReplayTutorial });
    fireEvent.click(screen.getByRole('button', { name: /replay tutorial/i }));
    expect(onReplayTutorial).toHaveBeenCalledOnce();
  });
});

describe('BankruptcyScreen — farm-events unlock tease (022)', () => {
  it('teases the farm-events unlock after an eventless run (022)', () => {
    renderScreen({ showEventsUnlockTease: true });
    expect(screen.getByText(/word of your farm is spreading/i)).toBeInTheDocument();
  });

  it('does not tease when events were already enabled', () => {
    renderScreen({ showEventsUnlockTease: false });
    expect(screen.queryByText(/word of your farm is spreading/i)).toBeNull();
  });
});

describe('BankruptcyScreen — 024 carries no chrome', () => {
  it('renders neither the game menu nor an analytics control', () => {
    renderScreen();
    expect(screen.queryByRole('button', { name: /game menu/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^analytics:/i })).toBeNull();
    // Restart is the one action this screen keeps.
    expect(screen.getByRole('button', { name: /restart game/i })).toBeInTheDocument();
  });
});

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

function hist(over: Partial<RunDayRecord>[] = []): RunDayRecord[] {
  return over.map((o, i) => ({
    day: i + 1, closingBalance: 100, taxDeducted: 6, harvestIncome: 30,
    unlockedPlots: 4, buildingCount: 0, ...o,
  }));
}

describe('BankruptcyScreen — 025 post-mortem', () => {
  it('shows a cause-of-death title alongside the medal', () => {
    renderScreen({
      runHistory: hist([{ taxDeducted: 30 }, { taxDeducted: 30 }, { taxDeducted: 30 }]),
      deathCause: 'fed_the_taxman',
    });
    expect(screen.getByText(/fed the taxman/i)).toBeInTheDocument();
    // The medal answers "how far"; the title answers "how you died". Both stay.
    // 027 — the badge's label is the farming title now, not the word "medal".
    expect(
      screen.getByRole('img', { name: new RegExp(MEDAL_LABELS.none, 'i') }),
    ).toBeInTheDocument();
  });

  it('replaces generic advice with the evidence line when history allows', () => {
    renderScreen({
      runHistory: hist([
        { closingBalance: 40, taxDeducted: 2 },
        { closingBalance: 40, taxDeducted: 2 },
        { closingBalance: 300, taxDeducted: 18 },
        { closingBalance: 310, taxDeducted: 18 },
        { closingBalance: 320, taxDeducted: 19 },
      ]),
      deathCause: 'out_of_seed_money',
    });
    expect(screen.getByText(/the taxman took \d+/i)).toBeInTheDocument();
    expect(screen.queryByText(/keep a reserve above your daily lease cost/i)).toBeNull();
  });

  it('falls back to generic advice on an empty history (migrated v10 save)', () => {
    renderScreen({ runHistory: [], deathCause: 'out_of_seed_money' });
    expect(screen.getByText(/plant early and harvest often|keep a reserve|went bankrupt early/i)).toBeInTheDocument();
    expect(screen.queryByText(/the taxman took/i)).toBeNull();
  });
});

// 029 — `2 (Summer Heat)` wrapped to two lines at text-title. The season *number* stays
// full size, matching every other row's hero number; only the name is demoted. Parens go,
// because brackets around a smaller-sized name read as noise.
describe('BankruptcyScreen — 029 season-reached value', () => {
  it('renders the number and name without parentheses', () => {
    renderScreen({ daysPlayed: 25, seasonReached: 2 });
    expect(screen.getByText('Summer Heat')).toBeInTheDocument();
    expect(screen.queryByText(/\(Summer Heat\)/)).toBeNull();
  });

  it('keeps the season number at title size and demotes only the name', () => {
    renderScreen({ daysPlayed: 25, seasonReached: 2 });
    const name = screen.getByText('Summer Heat');
    expect(name.className).toContain('text-caption');
    const value = name.parentElement!;
    expect(value.className).toContain('text-title');
    expect(value.textContent).toMatch(/^2\s+Summer Heat$/);
  });

  // The longest value the game can produce: Autumn Pressure is the longest of the five
  // season names, and endless mode is always "Deep Winter".
  it('handles the longest possible season name', () => {
    renderScreen({ daysPlayed: 45, seasonReached: 3 });
    const name = screen.getByText('Autumn Pressure');
    expect(name.parentElement!.textContent).toMatch(/^3\s+Autumn Pressure$/);
  });
});

describe('BankruptcyScreen — 029 new-best badge on its own line', () => {
  // On-device (iOS Safari) the inline `🏆 New Best!` badge shared the label's line and,
  // in the two-part Season-reached value, wrapped mid-badge. The badge now sits on its own
  // line beneath the value so line 1 (label ↔ value) never competes with it for width.
  it('puts the badge on a second line, out of both the label and the value', () => {
    renderScreen({
      daysPlayed: 25,
      seasonReached: 2,
      newBests: new Set(['bestSeasonReached']),
    });
    const badge = screen.getByLabelText('new personal best');
    const label = screen.getByText('Season reached');
    const value = screen.getByText('Summer Heat').parentElement!;

    expect(label).not.toContainElement(badge);
    expect(value).not.toContainElement(badge);
    // The badge follows the value in document order — i.e. it is on the line below it.
    expect(
      Boolean(value.compareDocumentPosition(badge) & Node.DOCUMENT_POSITION_FOLLOWING),
    ).toBe(true);
  });

  it('still renders one badge per new-best stat', () => {
    renderScreen({
      newBests: new Set(['bestDaysSurvived', 'bestPeakBalance', 'bestSeasonReached']),
    });
    expect(screen.getAllByLabelText('new personal best')).toHaveLength(3);
  });
});
