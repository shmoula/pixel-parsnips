import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const track = vi.hoisted(() => vi.fn());
vi.mock('../src/analytics/track', () => ({
  track,
  initAnalytics: vi.fn(),
  trackPlayStartedOnce: vi.fn(),
  setAnalyticsOptOut: vi.fn(),
}));
vi.mock('../src/analytics/useAnalyticsEvents', () => ({ useAnalyticsEvents: vi.fn() }));

// Pin the engine to a bankrupt run so App renders the BankruptcyScreen branch.
const { mockEngine } = vi.hoisted(() => ({ mockEngine: { current: null as unknown } }));
vi.mock('../src/engine/useGameEngine', () => ({
  useGameEngine: () => mockEngine.current,
}));

import App from '../src/App';
import { initialGameState } from '../src/engine/gameEngine';
import { loadOnboarding, markOnboardingComplete } from '../src/engine/onboarding';

beforeEach(() => {
  localStorage.clear();
  track.mockClear();
  mockEngine.current = {
    state: { ...initialGameState(), phase: 'bankrupt' },
    restart: vi.fn(),
    endOfRunRecap: null,
  };
});
afterEach(cleanup);

describe('replay tutorial tracking', () => {
  it('emits onboarding_replay_requested and still resets + restarts', () => {
    markOnboardingComplete(); // a finished tutorial is the precondition for replay
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /replay tutorial/i }));
    expect(track).toHaveBeenCalledWith('onboarding_replay_requested', {});
    // The existing behavior must be preserved: record reset + engine restart.
    expect(loadOnboarding().completed).toBe(false);
    expect((mockEngine.current as { restart: ReturnType<typeof vi.fn> }).restart).toHaveBeenCalledTimes(1);
  });
});
