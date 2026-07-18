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
    buildingsApplied: [],
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

  it('renders the pest infestation banner', () => {
    render(
      <DisasterBanner
        log={makeLog({ weatherId: 'pest_infestation', pestDestroyedPlots: [2, 4] })}
      />,
    );
    const banner = screen.getByLabelText(/disaster/i);
    expect(banner).toHaveTextContent(/pest/i);
  });

  it('renders the flash drought banner', () => {
    render(<DisasterBanner log={makeLog({ weatherId: 'flash_drought' })} />);
    const banner = screen.getByLabelText(/disaster/i);
    expect(banner).toHaveTextContent(/flash drought/i);
    expect(banner).toHaveTextContent(/half speed/i);
  });

  it('exposes the banner as an assertive live region so the staged reveal is announced', () => {
    render(<DisasterBanner log={makeLog({ weatherId: 'blight' })} />);
    const banner = screen.getByRole('alert');
    // Still findable by the aria-label the modal/banner tests rely on.
    expect(banner).toBe(screen.getByLabelText(/disaster/i));
    // role="alert" implies an assertive live region; be explicit in case it changes.
    expect(banner).toHaveAttribute('aria-live', 'assertive');
  });

  it('passes axe accessibility checks', async () => {
    const { container } = render(
      <DisasterBanner log={makeLog({ weatherId: 'blight' })} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('adds animation classes only when animate is set', () => {
    const { rerender } = render(
      <DisasterBanner log={makeLog({ weatherId: 'blight' })} animate />,
    );
    expect(screen.getByLabelText(/disaster/i)).toHaveClass('disaster-banner-anim');

    rerender(<DisasterBanner log={makeLog({ weatherId: 'blight' })} />);
    expect(screen.getByLabelText(/disaster/i)).not.toHaveClass('disaster-banner-anim');
  });
});

describe('DisasterBanner — accurate damage accounting (017 FR-019/FR-020)', () => {
  it('lists all destroyed plots when pests destroy several', () => {
    render(
      <DisasterBanner
        log={makeLog({ weatherId: 'pest_infestation', pestDestroyedPlots: [0, 2, 3] })}
      />,
    );
    const banner = screen.getByRole('alert');
    expect(banner).toHaveTextContent('3 plots destroyed by pests: #1, #3, #4.');
  });

  it('keeps the single-plot phrasing for one destroyed plot', () => {
    render(
      <DisasterBanner
        log={makeLog({ weatherId: 'pest_infestation', pestDestroyedPlots: [1] })}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Plot #2 destroyed by pests.');
  });

  it('does not overstate a pest event that destroyed nothing', () => {
    render(
      <DisasterBanner
        log={makeLog({ weatherId: 'pest_infestation', pestDestroyedPlots: [] })}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The pests found nothing to eat — no crops were growing.',
    );
  });

  it('notes that blight cost nothing when no harvests were due', () => {
    render(<DisasterBanner log={makeLog({ weatherId: 'blight', harvests: [] })} />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Nothing was due for harvest — no coins were lost.',
    );
  });
});
