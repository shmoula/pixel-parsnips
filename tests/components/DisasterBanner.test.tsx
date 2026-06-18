import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { DisasterBanner } from '../../src/components/DisasterBanner';
import type { DailyLogEntry } from '../../src/engine/types';

function makeLog(over: Partial<DailyLogEntry> = {}): DailyLogEntry {
  return {
    day: 14,
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

describe('DisasterBanner', () => {
  it('returns nothing for non-disaster weather', () => {
    const { container } = render(<DisasterBanner log={makeLog({ weatherId: 'sunny' })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the blight banner', () => {
    render(<DisasterBanner log={makeLog({ weatherId: 'blight', weatherMultiplier: 0.1 })} />);
    const banner = screen.getByLabelText(/disaster/i);
    expect(banner).toHaveTextContent(/blight/i);
  });

  it('renders one line per destroyed plot for pests', () => {
    render(
      <DisasterBanner
        log={makeLog({ weatherId: 'pest_infestation', pestDestroyedPlots: [2, 4] })}
      />,
    );
    const banner = screen.getByLabelText(/disaster/i);
    expect(banner).toHaveTextContent('Plot #3 destroyed by pests.');
    expect(banner).toHaveTextContent('Plot #5 destroyed by pests.');
  });

  it('renders the flash drought banner', () => {
    render(<DisasterBanner log={makeLog({ weatherId: 'flash_drought' })} />);
    const banner = screen.getByLabelText(/disaster/i);
    expect(banner).toHaveTextContent(/flash drought/i);
    expect(banner).toHaveTextContent(/half speed/i);
  });

  it('passes axe accessibility checks', async () => {
    const { container } = render(
      <DisasterBanner log={makeLog({ weatherId: 'blight' })} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
