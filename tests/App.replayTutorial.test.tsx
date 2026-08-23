import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Only analytics is mocked (no network); the real engine + real GameBoard render,
// so useOnboarding actually runs — that is what this regression needs to exercise.
vi.mock('../src/analytics/track', () => ({
  track: vi.fn(),
  initAnalytics: vi.fn(),
  trackPlayStartedOnce: vi.fn(),
  setAnalyticsOptOut: vi.fn(),
}));
vi.mock('../src/analytics/useAnalyticsEvents', () => ({ useAnalyticsEvents: vi.fn() }));

import App from '../src/App';
import { markOnboardingComplete } from '../src/engine/onboarding';

beforeEach(() => {
  localStorage.clear();
});
afterEach(cleanup);

describe('App — 024 in-run replay tutorial', () => {
  it('restarts the tutorial from the in-run game menu, where GameBoard stays mounted', async () => {
    // Precondition for a replay: the tutorial is already finished, so it is not
    // active on load. This is the state every returning player is in.
    markOnboardingComplete();
    render(<App />);
    // Sanity: no tutorial welcome card showing yet.
    expect(screen.queryByRole('button', { name: /plant my farm/i })).toBeNull();

    // Open the game menu and confirm the two-step "Replay tutorial" row.
    await userEvent.click(screen.getByRole('button', { name: /game menu/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /replay tutorial \(restarts run\)/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /tap again to replay/i }));

    // The welcome step must now be showing — the whole point of "replay". Before
    // the fix the in-run menu reset the run but left GameBoard mounted, so the
    // one-time onboarding init never re-ran and the tutorial stayed inactive.
    expect(await screen.findByRole('button', { name: /plant my farm/i })).toBeInTheDocument();
  });
});
