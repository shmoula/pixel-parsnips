import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';

const track = vi.hoisted(() => vi.fn());
vi.mock('../../src/analytics/track', () => ({
  track,
  initAnalytics: vi.fn(),
  trackPlayStartedOnce: vi.fn(),
  setAnalyticsOptOut: vi.fn(),
}));

import { GameBoard } from '../../src/components/GameBoard';
import { initialGameState } from '../../src/engine/gameEngine';
import { markOnboardingComplete } from '../../src/engine/onboarding';
import type { GameState } from '../../src/engine/types';

function makeProps(state: GameState = initialGameState()) {
  return {
    state,
    lastDailyLog: null,
    onNextDay: vi.fn(),
    onPlantSeed: vi.fn().mockReturnValue(false),
    onBuySeed: vi.fn(),
    onBuyFertilizer: vi.fn(),
    onApplyFertilizer: vi.fn(),
    onClearPestDamage: vi.fn(),
    getFertilizerCount: () => 0,
    getSeedPrice: () => 5,
    onBuyPlot: vi.fn().mockReturnValue(false),
    getNextPlotPrice: () => null as number | null,
    recoveryDays: 3,
    buildingCards: [],
    onBuyBuilding: vi.fn().mockReturnValue(false),
    onRestart: vi.fn(),
    pendingFarmEvent: null,
    onResolveFarmEvent: vi.fn().mockReturnValue(false),
  };
}

beforeEach(() => {
  localStorage.clear();
  track.mockClear();
});
afterEach(cleanup);

/** Fresh state has no crops planted, so Next Day reads "Skip day" and opens the confirm. */
function openEmptyDayDialog() {
  fireEvent.click(screen.getAllByRole('button', { name: /skip day/i })[0]);
  return screen.getByRole('dialog', { name: /advance empty day/i });
}

describe('empty_day_safeguard tracking', () => {
  it('emits cancelled with full context when the player backs out', () => {
    markOnboardingComplete(); // tutorial not running
    const props = makeProps();
    render(<GameBoard {...props} />);
    const dialog = openEmptyDayDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));
    expect(track).toHaveBeenCalledWith('empty_day_safeguard', {
      action: 'cancelled',
      onboarding_active: false,
      day: props.state.currentDay,
      coin_balance: props.state.coinBalance,
    });
    expect(props.onNextDay).not.toHaveBeenCalled();
  });

  it('emits advanced and still advances the day', () => {
    markOnboardingComplete();
    const props = makeProps();
    render(<GameBoard {...props} />);
    const dialog = openEmptyDayDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: /^advance$/i }));
    expect(track).toHaveBeenCalledWith(
      'empty_day_safeguard',
      expect.objectContaining({ action: 'advanced' }),
    );
    expect(props.onNextDay).toHaveBeenCalledTimes(1);
  });

  it('flags onboarding_active while the tutorial is running', () => {
    // Fresh localStorage: onboarding auto-starts at welcome on a day-1 board.
    const props = makeProps();
    render(<GameBoard {...props} />);
    const dialog = openEmptyDayDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));
    expect(track).toHaveBeenCalledWith(
      'empty_day_safeguard',
      expect.objectContaining({ action: 'cancelled', onboarding_active: true }),
    );
  });
});
