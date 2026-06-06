import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { BankruptcyScreen } from '../../src/components/BankruptcyScreen';
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

function renderScreen(props: Partial<React.ComponentProps<typeof BankruptcyScreen>> = {}) {
  return render(
    <BankruptcyScreen
      daysPlayed={12}
      peakBalance={150}
      disastersSurvived={1}
      seasonReached={1}
      medal="none"
      records={emptyRecords}
      newBests={new Set()}
      onRestart={vi.fn()}
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
      expect(screen.getByRole('img', { name: new RegExp(medal === 'none' ? 'No medal' : medal, 'i') })).toBeInTheDocument();
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
    const streakRow = screen.getByText('Longest streak').closest('div')!;
    expect(streakRow).toHaveTextContent('6');
    expect(within(streakRow).getByLabelText(/new personal best/i)).toBeInTheDocument();
    expect(screen.getByText(/Best streak/i)).toBeInTheDocument();
  });
});
