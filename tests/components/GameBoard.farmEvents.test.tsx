import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { GameBoard } from '../../src/components/GameBoard';
import { initialGameState } from '../../src/engine/gameEngine';
import { markOnboardingComplete } from '../../src/engine/onboarding';
import { FARM_EVENT_DEFINITIONS } from '../../src/engine/farmEventCatalog';
import type { DailyLogEntry, GameState } from '../../src/engine/types';
import type { PendingFarmEventView } from '../../src/engine/useGameEngine';

const merchantView: PendingFarmEventView = {
  def: FARM_EVENT_DEFINITIONS.find(e => e.id === 'traveling_merchant')!,
  offerValue: 0,
  balance: 100,
  isNew: false,
};

/** Reuses the GameBoard fixture pattern from GameBoard.safeguard.test.tsx,
 * extended with the 022 farm-event props. A growing crop keeps
 * canAdvanceProductively() true so the Next Day HUD button's accessible
 * name is "Advance to next day" (matches /next day/i) in every test here. */
function makeProps(overrides: {
  pendingFarmEvent?: PendingFarmEventView | null;
  onNextDay?: () => void;
  onResolveFarmEvent?: (choice: 'A' | 'B') => boolean;
} = {}) {
  const base = initialGameState();
  const plots = base.plots.map(p =>
    p.id === 0 ? { ...p, cropId: 'radish' as const, dayPlanted: 1, daysRemaining: 1 } : p,
  );
  const state: GameState = { ...base, plots, coinBalance: 93 };
  return {
    state,
    lastDailyLog: null as DailyLogEntry | null,
    onNextDay: overrides.onNextDay ?? vi.fn(),
    onPlantSeed: vi.fn().mockReturnValue(false),
    onBuySeed: vi.fn(),
    onBuyFertilizer: vi.fn(),
    onApplyFertilizer: vi.fn(),
    onClearPestDamage: vi.fn(),
    getFertilizerCount: () => 0,
    getSeedPrice: () => 5,
    seedYieldMultiplier: 1,
    onBuyPlot: vi.fn().mockReturnValue(false),
    getNextPlotPrice: () => null as number | null,
    recoveryDays: 3,
    buildingCards: [],
    onBuyBuilding: vi.fn().mockReturnValue(false),
    onRestart: vi.fn(),
    pendingFarmEvent: overrides.pendingFarmEvent ?? null,
    onResolveFarmEvent: overrides.onResolveFarmEvent ?? vi.fn().mockReturnValue(true),
  };
}

beforeEach(() => {
  localStorage.clear();
  markOnboardingComplete(); // tutorial not running — keep the board's focus on farm events
});
afterEach(cleanup);

describe('GameBoard x farm events', () => {
  it('renders the FarmEventModal when a pending view is supplied', () => {
    const props = makeProps({ pendingFarmEvent: merchantView });
    render(<GameBoard {...props} />);
    expect(screen.getByRole('dialog', { name: 'The Traveling Merchant' })).toBeInTheDocument();
  });

  it('does not render the modal when there is no pending event', () => {
    const props = makeProps();
    render(<GameBoard {...props} />);
    expect(screen.queryByRole('dialog', { name: 'The Traveling Merchant' })).toBeNull();
  });

  it('does not advance the day while an event is pending', () => {
    const onNextDay = vi.fn();
    const props = makeProps({ pendingFarmEvent: merchantView, onNextDay });
    render(<GameBoard {...props} />);
    // Confirm the modal is up (the guard's precondition).
    expect(screen.getByRole('dialog', { name: 'The Traveling Merchant' })).toBeInTheDocument();
    // Click the (desktop) Next Day button in the HUD — the guard must no-op it.
    fireEvent.click(screen.getAllByRole('button', { name: /next day/i })[0]);
    expect(onNextDay).not.toHaveBeenCalled();
  });

  it('routes the modal choice to onResolveFarmEvent', () => {
    const onResolveFarmEvent = vi.fn().mockReturnValue(true);
    const props = makeProps({ pendingFarmEvent: merchantView, onResolveFarmEvent });
    render(<GameBoard {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /decline/i }));
    expect(onResolveFarmEvent).toHaveBeenCalledWith('B');
  });

  // Regression test: isNew must come from the view (re-read fresh by the
  // caller on every render), NOT a value frozen in GameBoard state at mount.
  // A run restart (endRunVictory/restart) commits fresh state into the SAME
  // GameBoard mount — rerendering with a new view is exactly that scenario.
  it('reflects the pending view\'s isNew live across rerenders on the same mount', () => {
    const props = makeProps({ pendingFarmEvent: { ...merchantView, isNew: true } });
    const { rerender } = render(<GameBoard {...props} />);
    expect(screen.getByText('New!')).toBeInTheDocument();

    rerender(<GameBoard {...props} pendingFarmEvent={{ ...merchantView, isNew: false }} />);
    expect(screen.queryByText('New!')).toBeNull();
  });
});
