import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    render(<GameMenu onRestart={noop} onReplayTutorial={noop} />);
    expect(screen.getByRole('button', { name: /game menu/i })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens on click and moves focus to the first row', async () => {
    render(<GameMenu onRestart={noop} onReplayTutorial={noop} />);
    await openMenu();
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /game menu/i })).toHaveAttribute('aria-expanded', 'true');
    const rows = screen.getAllByRole('menuitem');
    expect(rows[0]).toHaveFocus();
  });

  it('closes on Escape and returns focus to the gear', async () => {
    render(<GameMenu onRestart={noop} onReplayTutorial={noop} />);
    await openMenu();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('button', { name: /game menu/i })).toHaveFocus();
  });

  it('closes on an outside click', async () => {
    render(
      <div>
        <button type="button">outside</button>
        <GameMenu onRestart={noop} onReplayTutorial={noop} />
      </div>,
    );
    await openMenu();
    await userEvent.click(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('has no accessibility violations while open', async () => {
    const { container } = render(<GameMenu onRestart={noop} onReplayTutorial={noop} />);
    await openMenu();
    // @ts-expect-error matcher registered in tests/setup.ts
    expect(await import('vitest-axe').then((m) => m.axe(container))).toHaveNoViolations();
  });
});

describe('GameMenu — Sound row', () => {
  it('reads on by default and mutes on activation', async () => {
    render(<GameMenu onRestart={noop} onReplayTutorial={noop} />);
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
    render(<GameMenu onRestart={noop} onReplayTutorial={noop} />);
    await openMenu();
    expect(screen.getByRole('menuitemcheckbox', { name: /sound/i })).toHaveAttribute('aria-checked', 'false');
  });

  it('stays open after toggling sound', async () => {
    render(<GameMenu onRestart={noop} onReplayTutorial={noop} />);
    await openMenu();
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: /sound/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });
});

describe('GameMenu — analytics row', () => {
  it('reads on by default and opts out on activation', async () => {
    render(<GameMenu onRestart={noop} onReplayTutorial={noop} />);
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
    render(<GameMenu onRestart={noop} onReplayTutorial={noop} />);
    await openMenu();

    const row = screen.getByRole('menuitemcheckbox', { name: /anonymous analytics/i });
    expect(row).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(row);

    expect(localStorage.getItem(ANALYTICS_OPT_OUT_KEY)).toBeNull();
    expect(setAnalyticsOptOut).toHaveBeenCalledWith(false);
  });

  it('is inert under Do Not Track and explains why in readable text', async () => {
    Object.defineProperty(window.navigator, 'doNotTrack', { value: '1', configurable: true });
    render(<GameMenu onRestart={noop} onReplayTutorial={noop} />);
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
    render(<GameMenu onRestart={onRestart} onReplayTutorial={noop} />);
    await openMenu();

    const row = screen.getByRole('menuitem', { name: /restart run/i });
    await userEvent.click(row);
    expect(onRestart).not.toHaveBeenCalled();

    const armed = screen.getByRole('menuitem', { name: /tap again to restart/i });
    await userEvent.click(armed);
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it('closes the menu once restart is confirmed', async () => {
    render(<GameMenu onRestart={noop} onReplayTutorial={noop} />);
    await openMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: /restart run/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /tap again to restart/i }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('disarms restart when the menu is closed and reopened', async () => {
    const onRestart = vi.fn();
    render(<GameMenu onRestart={onRestart} onReplayTutorial={noop} />);
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
      render(<GameMenu onRestart={onRestart} onReplayTutorial={noop} />);

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

  it('says out loud that replaying the tutorial restarts the run', async () => {
    const onReplayTutorial = vi.fn();
    render(<GameMenu onRestart={noop} onReplayTutorial={onReplayTutorial} />);
    await openMenu();

    const row = screen.getByRole('menuitem', { name: /replay tutorial \(restarts run\)/i });
    await userEvent.click(row);
    expect(onReplayTutorial).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('menuitem', { name: /tap again to replay/i }));
    expect(onReplayTutorial).toHaveBeenCalledTimes(1);
  });
});
