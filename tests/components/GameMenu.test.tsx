import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { setAnalyticsOptOut, track } = vi.hoisted(() => ({
  setAnalyticsOptOut: vi.fn(),
  track: vi.fn(),
}));
vi.mock('../../src/analytics/track', () => ({ setAnalyticsOptOut, track }));
import { cleanup, render, screen } from '@testing-library/react';
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
    // NOTE: Task 6 will add `menuitem` action rows and this becomes getAllByRole('menuitem').
    // Until then the Sound row (menuitemcheckbox) is the first row.
    expect(screen.getByRole('menuitemcheckbox', { name: /sound/i })).toHaveFocus();
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
