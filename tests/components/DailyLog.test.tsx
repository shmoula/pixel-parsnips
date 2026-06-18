import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { DailyLog } from '../../src/components/DailyLog';
import type { DailyLogEntry } from '../../src/engine/types';

function makeLog(over: Partial<DailyLogEntry> = {}): DailyLogEntry {
  return {
    day: 5,
    weatherId: 'sunny',
    weatherMultiplier: 1,
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

describe('DailyLog — harvest streak rows', () => {
  it('renders the streak bonus line when streakBonus > 0', () => {
    render(<DailyLog log={makeLog({ streakBefore: 3, streakAfter: 4, streakBonus: 15 })} />);
    const row = screen.getByLabelText(/streak bonus/i);
    expect(row).toHaveTextContent('×3');
    expect(row).toHaveTextContent('+15');
  });

  it('renders the miss-day reset note when no harvest happened', () => {
    render(<DailyLog log={makeLog({ streakBefore: 4, streakAfter: 0, streakBonus: 0, harvests: [] })} />);
    const note = screen.getByLabelText(/streak reset/i);
    expect(note).toHaveTextContent('Streak reset');
    expect(note).not.toHaveTextContent(/new season/i);
  });

  it('renders the season-reset variant when harvest happened but streak still cleared', () => {
    render(
      <DailyLog
        log={makeLog({
          streakBefore: 4,
          streakAfter: 0,
          streakBonus: 20,
          harvests: [{ plotId: 0, cropId: 'radish', baseYield: 12, weatherMultiplier: 1, adjustedYield: 12 }],
          totalHarvestIncome: 12,
        })}
      />,
    );
    expect(screen.getByLabelText(/streak reset/i)).toHaveTextContent(/new season reset the streak/i);
  });

  it('renders neither row on a quiet pre-streak day', () => {
    render(<DailyLog log={makeLog({ streakBefore: 0, streakAfter: 0, streakBonus: 0 })} />);
    expect(screen.queryByLabelText(/streak bonus/i)).toBeNull();
    expect(screen.queryByLabelText(/streak reset/i)).toBeNull();
  });

  it('passes axe accessibility checks', async () => {
    const { container } = render(<DailyLog log={makeLog()} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('DailyLog — market', () => {
  it('shows the active event line', () => {
    render(
      <DailyLog
        log={makeLog({
          marketActive: { cropId: 'pumpkin', kind: 'shortage', multiplier: 1.4, daysRemaining: 2 },
        })}
      />,
    );
    expect(screen.getByText(/Pumpkins shortage: yield \+40% \(2 days left\)/)).toBeInTheDocument();
  });

  it('shows the tomorrow announcement line', () => {
    render(
      <DailyLog
        log={makeLog({
          marketAnnounced: { cropId: 'radish', kind: 'glut', multiplier: 0.7 },
        })}
      />,
    );
    expect(screen.getByText(/Tomorrow:/)).toBeInTheDocument();
    expect(screen.getByText(/flooded with Radishes/)).toBeInTheDocument();
  });

  it('shows neither line when there is no market activity', () => {
    render(<DailyLog log={makeLog()} />);
    expect(screen.queryByText(/Tomorrow:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/yield/)).not.toBeInTheDocument();
  });
});

describe('DailyLog — disaster lines moved to DisasterBanner', () => {
  it('no longer renders the inline flash-drought line', () => {
    render(<DailyLog log={makeLog({ weatherId: 'flash_drought', flashDroughtDaysAfter: 2 })} />);
    expect(screen.queryByText(/grow at half speed/i)).toBeNull();
  });

  it('no longer renders the inline pest-destroyed lines', () => {
    render(<DailyLog log={makeLog({ weatherId: 'pest_infestation', pestDestroyedPlots: [0, 1] })} />);
    expect(screen.queryByText(/destroyed by pests/i)).toBeNull();
  });

  it('still renders the exhaustion line', () => {
    render(<DailyLog log={makeLog({ exhaustedPlots: [3] })} />);
    expect(screen.getByText(/Plot #4 became exhausted/i)).toBeInTheDocument();
  });

  it('renders the weather badge neutrally when suppressDisasterStyling is set', () => {
    render(<DailyLog log={makeLog({ weatherId: 'blight' })} suppressDisasterStyling />);
    const badge = screen.getByText('Blight').closest('div')!;
    expect(badge.className).not.toMatch(/farm-red/);
  });

  it('renders the weather badge with alarm styling by default for disasters', () => {
    render(<DailyLog log={makeLog({ weatherId: 'blight' })} />);
    const badge = screen.getByText('Blight').closest('div')!;
    expect(badge.className).toMatch(/farm-red/);
  });
});
