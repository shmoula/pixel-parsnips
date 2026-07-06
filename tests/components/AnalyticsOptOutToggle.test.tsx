import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { setAnalyticsOptOut } = vi.hoisted(() => ({ setAnalyticsOptOut: vi.fn() }));
vi.mock('../../src/analytics/track', () => ({ setAnalyticsOptOut }));

import { AnalyticsOptOutToggle } from '../../src/components/AnalyticsOptOutToggle';
import { ANALYTICS_OPT_OUT_KEY } from '../../src/analytics/consent';

beforeEach(() => {
  localStorage.clear();
  setAnalyticsOptOut.mockClear();
  Object.defineProperty(window.navigator, 'doNotTrack', { value: null, configurable: true });
});

describe('AnalyticsOptOutToggle', () => {
  it('reflects the default opted-in state and opts out on click', async () => {
    render(<AnalyticsOptOutToggle />);
    const btn = screen.getByRole('button', { name: /analytics/i });
    expect(btn).toHaveTextContent(/on/i);

    await userEvent.click(btn);

    expect(localStorage.getItem(ANALYTICS_OPT_OUT_KEY)).toBe('true');
    expect(setAnalyticsOptOut).toHaveBeenCalledWith(true);
    expect(btn).toHaveTextContent(/off/i);
  });

  it('reflects a persisted opted-out state and opts back in on click', async () => {
    localStorage.setItem(ANALYTICS_OPT_OUT_KEY, 'true');
    render(<AnalyticsOptOutToggle />);
    const btn = screen.getByRole('button', { name: /analytics/i });
    expect(btn).toHaveTextContent(/off/i);

    await userEvent.click(btn);

    expect(localStorage.getItem(ANALYTICS_OPT_OUT_KEY)).toBeNull();
    expect(setAnalyticsOptOut).toHaveBeenCalledWith(false);
  });

  it('shows off and is disabled/inert when Do-Not-Track is set', async () => {
    Object.defineProperty(window.navigator, 'doNotTrack', { value: '1', configurable: true });
    render(<AnalyticsOptOutToggle />);
    const btn = screen.getByRole('button', { name: /analytics/i });
    expect(btn).toHaveTextContent(/off/i);
    expect(btn).toBeDisabled();

    await userEvent.click(btn);

    // DNT hard-disables tracking: the click must not mutate consent or notify.
    expect(localStorage.getItem(ANALYTICS_OPT_OUT_KEY)).toBeNull();
    expect(setAnalyticsOptOut).not.toHaveBeenCalled();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<AnalyticsOptOutToggle />);
    // @ts-expect-error matcher registered in tests/setup.ts
    expect(await import('vitest-axe').then((m) => m.axe(container))).toHaveNoViolations();
  });
});

afterEach(cleanup);
