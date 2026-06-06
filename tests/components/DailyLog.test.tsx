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
