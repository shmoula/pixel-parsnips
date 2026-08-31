import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const { setAnalyticsOptOut, track } = vi.hoisted(() => ({
  setAnalyticsOptOut: vi.fn(),
  track: vi.fn(),
}));
vi.mock('../../src/analytics/track', () => ({ setAnalyticsOptOut, track }));
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameMenu } from '../../src/components/GameMenu';
import { AUDIO_KEY, isMuted } from '../../src/audio/sfx';
import { ANALYTICS_OPT_OUT_KEY } from '../../src/analytics/consent';

const noop = () => {};
const menuProps = {
  onRestart: noop,
  onReplayTutorial: noop,
  onLastTurn: noop,
  hasLastTurn: true,
};

// The popover body and the credits modal are lazy-loaded (code-split off the
// entry bundle). Resolve both chunks once up front: React.lazy caches the
// resolved module, so every later render mounts them synchronously — keeping the
// specs below (including the fake-timer one, where awaiting a dynamic import is
// impractical) free of async menu queries.
beforeAll(async () => {
  render(<GameMenu {...menuProps} />);
  await userEvent.click(screen.getByRole('button', { name: /game menu/i }));
  await screen.findByRole('menu');
  await userEvent.click(screen.getByRole('menuitem', { name: /credits/i }));
  await screen.findByRole('dialog', { name: /credits/i });
  cleanup();
});

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window.navigator, 'doNotTrack', { value: null, configurable: true });
  setAnalyticsOptOut.mockClear();
  track.mockClear();
});

afterEach(cleanup);

async function openMenu() {
  await userEvent.click(screen.getByRole('button', { name: /game menu/i }));
}

describe('GameMenu — popover shell', () => {
  it('renders a gear trigger and no menu until it is opened', () => {
    render(<GameMenu {...menuProps} />);
    expect(screen.getByRole('button', { name: /game menu/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens on click and moves focus to the first row', async () => {
    render(<GameMenu {...menuProps} />);
    await openMenu();
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /game menu/i })).toHaveAttribute('aria-expanded', 'true');
    const rows = screen.getAllByRole('menuitem');
    expect(rows[0]).toHaveFocus();
  });

  it('closes on Escape and returns focus to the gear', async () => {
    render(<GameMenu {...menuProps} />);
    await openMenu();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('button', { name: /game menu/i })).toHaveFocus();
  });

  it('closes on an outside click', async () => {
    render(
      <div>
        <button type="button">outside</button>
        <GameMenu {...menuProps} />
      </div>,
    );
    await openMenu();
    await userEvent.click(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('has no accessibility violations while open', async () => {
    const { container } = render(<GameMenu {...menuProps} />);
    await openMenu();
    // @ts-expect-error matcher registered in tests/setup.ts
    expect(await import('vitest-axe').then((m) => m.axe(container))).toHaveNoViolations();
  });
});

describe('GameMenu — Sound row', () => {
  it('reads on by default and mutes on activation', async () => {
    render(<GameMenu {...menuProps} />);
    await openMenu();

    const row = screen.getByRole('menuitemcheckbox', { name: /sound/i });
    expect(row).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(row);

    expect(row).toHaveAttribute('aria-checked', 'false');
    expect(isMuted()).toBe(true);
    expect(JSON.parse(localStorage.getItem(AUDIO_KEY)!)).toEqual({ schemaVersion: 1, muted: true });
  });

  it('initializes from the persisted muted value', async () => {
    localStorage.setItem(AUDIO_KEY, JSON.stringify({ schemaVersion: 1, muted: true }));
    render(<GameMenu {...menuProps} />);
    await openMenu();
    expect(screen.getByRole('menuitemcheckbox', { name: /sound/i })).toHaveAttribute('aria-checked', 'false');
  });

  it('stays open after toggling sound', async () => {
    render(<GameMenu {...menuProps} />);
    await openMenu();
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: /sound/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });
});

describe('GameMenu — analytics row', () => {
  it('reads on by default and opts out on activation', async () => {
    render(<GameMenu {...menuProps} />);
    await openMenu();

    const row = screen.getByRole('menuitemcheckbox', { name: /anonymous analytics/i });
    expect(row).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(row);

    expect(localStorage.getItem(ANALYTICS_OPT_OUT_KEY)).toBe('true');
    expect(setAnalyticsOptOut).toHaveBeenCalledWith(true);
    expect(row).toHaveAttribute('aria-checked', 'false');
  });

  it('reflects a persisted opted-out state and opts back in', async () => {
    localStorage.setItem(ANALYTICS_OPT_OUT_KEY, 'true');
    render(<GameMenu {...menuProps} />);
    await openMenu();

    const row = screen.getByRole('menuitemcheckbox', { name: /anonymous analytics/i });
    expect(row).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(row);

    expect(localStorage.getItem(ANALYTICS_OPT_OUT_KEY)).toBeNull();
    expect(setAnalyticsOptOut).toHaveBeenCalledWith(false);
  });

  it('is inert under Do Not Track and explains why in readable text', async () => {
    Object.defineProperty(window.navigator, 'doNotTrack', { value: '1', configurable: true });
    render(<GameMenu {...menuProps} />);
    await openMenu();

    const row = screen.getByRole('menuitemcheckbox', { name: /anonymous analytics/i });
    expect(row).toHaveAttribute('aria-checked', 'false');
    expect(row).toBeDisabled();
    // The reason must be real text, not a title tooltip — tooltips do not exist on touch.
    expect(row).toHaveTextContent(/do not track/i);

    await userEvent.click(row);

    expect(localStorage.getItem(ANALYTICS_OPT_OUT_KEY)).toBeNull();
    expect(setAnalyticsOptOut).not.toHaveBeenCalled();
  });
});

describe('GameMenu — run-resetting rows', () => {
  it('requires two activations to restart', async () => {
    const onRestart = vi.fn();
    render(<GameMenu onRestart={onRestart} onReplayTutorial={noop} onLastTurn={noop} hasLastTurn />);
    await openMenu();

    const row = screen.getByRole('menuitem', { name: /restart run/i });
    await userEvent.click(row);
    expect(onRestart).not.toHaveBeenCalled();

    const armed = screen.getByRole('menuitem', { name: /tap again to restart/i });
    await userEvent.click(armed);
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it('closes the menu once restart is confirmed', async () => {
    render(<GameMenu {...menuProps} />);
    await openMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: /restart run/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /tap again to restart/i }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('disarms restart when the menu is closed and reopened', async () => {
    const onRestart = vi.fn();
    render(<GameMenu onRestart={onRestart} onReplayTutorial={noop} onLastTurn={noop} hasLastTurn />);
    await openMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: /restart run/i }));

    await userEvent.keyboard('{Escape}');
    await openMenu();

    // Back to the unarmed label; a single click must not restart.
    await userEvent.click(screen.getByRole('menuitem', { name: /restart run/i }));
    expect(onRestart).not.toHaveBeenCalled();
  });

  it('disarms restart after the arm window elapses', () => {
    // NOTE: userEvent + vitest v4 fake timers deadlock (the click promise never
    // settles), so this uses fireEvent + act like the repo's other fake-timer
    // tests. The behaviour under test — the arm window expiring — is unchanged.
    vi.useFakeTimers();
    try {
      const onRestart = vi.fn();
      render(<GameMenu onRestart={onRestart} onReplayTutorial={noop} onLastTurn={noop} hasLastTurn />);

      fireEvent.click(screen.getByRole('button', { name: /game menu/i }));
      fireEvent.click(screen.getByRole('menuitem', { name: /restart run/i }));
      expect(screen.getByRole('menuitem', { name: /tap again to restart/i })).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(screen.getByRole('menuitem', { name: /restart run/i })).toBeInTheDocument();
      expect(onRestart).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('announces to assistive tech that a second tap confirms the restart', async () => {
    render(<GameMenu {...menuProps} />);
    await openMenu();

    // Nothing is announced before the row is armed.
    expect(screen.queryByText(/activate again to confirm/i)).toBeNull();

    await userEvent.click(screen.getByRole('menuitem', { name: /restart run/i }));

    // The silent label swap is mirrored into a live region so it is read aloud.
    expect(screen.getByText(/restart run armed\. activate again to confirm/i)).toBeInTheDocument();
  });

  it('announces the replay-tutorial arming, warning it restarts the run', async () => {
    render(<GameMenu {...menuProps} />);
    await openMenu();

    await userEvent.click(screen.getByRole('menuitem', { name: /^replay tutorial$/i }));

    expect(
      screen.getByText(/replay tutorial armed\. activate again to confirm — this restarts your run/i),
    ).toBeInTheDocument();
  });

  it('warns that replaying restarts the run once armed, not in the resting label', async () => {
    const onReplayTutorial = vi.fn();
    render(<GameMenu onRestart={noop} onReplayTutorial={onReplayTutorial} onLastTurn={noop} hasLastTurn />);
    await openMenu();

    // Resting label is just "Replay tutorial" — the "(restarts run)" warning is
    // not there, so the row stays one line.
    const row = screen.getByRole('menuitem', { name: /^replay tutorial$/i });
    await userEvent.click(row);
    expect(onReplayTutorial).not.toHaveBeenCalled();

    // Armed: the warning appears alongside the confirm affordance.
    await userEvent.click(screen.getByRole('menuitem', { name: /tap again to replay \(restarts run\)/i }));
    expect(onReplayTutorial).toHaveBeenCalledTimes(1);
  });
});

describe('GameMenu — credits row', () => {
  it('opens the credits modal, closes the popover, and tracks the view', async () => {
    render(<GameMenu {...menuProps} />);
    await openMenu();

    await userEvent.click(screen.getByRole('menuitem', { name: /credits/i }));

    expect(screen.getByRole('dialog', { name: /credits/i })).toBeInTheDocument();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(track).toHaveBeenCalledWith('credits_viewed', {});
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('returns focus to the gear when the credits modal closes', async () => {
    render(<GameMenu {...menuProps} />);
    await openMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: /credits/i }));

    await userEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: /game menu/i })).toHaveFocus();
  });
});

describe('GameMenu — 029 last-turn row', () => {
  it('reopens the previous turn and closes the menu', async () => {
    const onLastTurn = vi.fn();
    render(<GameMenu {...menuProps} onLastTurn={onLastTurn} />);
    await openMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: /view last turn/i }));
    expect(onLastTurn).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('is disabled when there is no previous turn', async () => {
    const onLastTurn = vi.fn();
    render(<GameMenu {...menuProps} hasLastTurn={false} onLastTurn={onLastTurn} />);
    await openMenu();
    const row = screen.getByRole('menuitem', { name: /view last turn/i });
    expect(row).toBeDisabled();
    await userEvent.click(row);
    expect(onLastTurn).not.toHaveBeenCalled();
  });

  // Regression: "View last turn" is the first DOM row, so the focus-on-mount effect
  // must skip it while it is disabled (the common case — Day 1, or any turn with no
  // previous summary) and land on the next focusable row instead. Landing on nothing
  // (focus stuck on the gear under the open popover) is a keyboard/screen-reader trap.
  it('skips the disabled first row and focuses the next one when opened', async () => {
    render(<GameMenu {...menuProps} hasLastTurn={false} />);
    await openMenu();
    expect(screen.getByRole('menuitem', { name: /view last turn/i })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: /view last turn/i })).not.toHaveFocus();
    expect(screen.getByRole('menuitem', { name: /restart run/i })).toHaveFocus();
  });
});
