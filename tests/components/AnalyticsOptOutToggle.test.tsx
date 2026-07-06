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

  it('has no accessibility violations', async () => {
    const { container } = render(<AnalyticsOptOutToggle />);
    // @ts-expect-error matcher registered in tests/setup.ts
    expect(await import('vitest-axe').then((m) => m.axe(container))).toHaveNoViolations();
  });
});

afterEach(cleanup);
