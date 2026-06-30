import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { OnboardingOverlay } from '../../src/components/OnboardingOverlay';

const noop = () => {};

describe('OnboardingOverlay', () => {
  it('shows the welcome copy and a start CTA', () => {
    render(
      <OnboardingOverlay step="welcome" harvestIncome={0} netIncome={0}
        onStart={noop} onSkip={noop} onDismissPayoff={noop} />,
    );
    expect(screen.getByText(/fill your farm with radishes/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /plant/i })).toBeInTheDocument();
  });

  it('fires onStart from the welcome CTA', () => {
    const onStart = vi.fn();
    render(
      <OnboardingOverlay step="welcome" harvestIncome={0} netIncome={0}
        onStart={onStart} onSkip={noop} onDismissPayoff={noop} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /plant/i }));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it('always shows a Skip control', () => {
    render(
      <OnboardingOverlay step="buy-radishes" harvestIncome={0} netIncome={0}
        onStart={noop} onSkip={noop} onDismissPayoff={noop} />,
    );
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
  });

  it('leads with net profit, mentions the gross sale, and has a dismiss CTA on payoff', () => {
    const onDismiss = vi.fn();
    render(
      <OnboardingOverlay step="payoff" harvestIncome={48} netIncome={25}
        onStart={noop} onSkip={noop} onDismissPayoff={onDismiss} />,
    );
    // Net profit is the headline (matches the Day Summary's hero figure)...
    expect(screen.getByText(/\+25/)).toBeInTheDocument();
    // ...and the gross sale is shown as context for where it came from.
    expect(screen.getByText(/48/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /got it|continue|hit your/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('renders the step copy for an anchored step even when the anchor is absent', () => {
    render(
      <OnboardingOverlay step="plant" harvestIncome={0} netIncome={0}
        onStart={noop} onSkip={noop} onDismissPayoff={noop} />,
    );
    expect(screen.getByText(/fill every plot/i)).toBeInTheDocument();
  });

  it('omits the pulse animation on the highlight ring under reduced motion', () => {
    // Force prefers-reduced-motion: reduce
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    }));

    // The 'advance' step anchors to [data-onboarding="next-day"]; insert it so the ring renders.
    const anchor = document.createElement('button');
    anchor.setAttribute('data-onboarding', 'next-day');
    document.body.appendChild(anchor);

    const { container } = render(
      <OnboardingOverlay step="advance" harvestIncome={0} netIncome={0}
        onStart={noop} onSkip={noop} onDismissPayoff={noop} />,
    );

    const ring = container.querySelector('.ring-farm-gold');
    expect(ring).toBeTruthy();
    expect(ring!.className).not.toContain('animate-pulse');

    document.body.removeChild(anchor);
    vi.unstubAllGlobals();
  });

  it('includes the pulse animation on the highlight ring when motion is allowed', () => {
    // matchMedia returns matches: false for reduced-motion query (motion allowed)
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    }));

    const anchor = document.createElement('button');
    anchor.setAttribute('data-onboarding', 'next-day');
    document.body.appendChild(anchor);

    const { container } = render(
      <OnboardingOverlay step="advance" harvestIncome={0} netIncome={0}
        onStart={noop} onSkip={noop} onDismissPayoff={noop} />,
    );

    const ring = container.querySelector('.ring-farm-gold');
    expect(ring).toBeTruthy();
    expect(ring!.className).toContain('animate-pulse');

    document.body.removeChild(anchor);
    vi.unstubAllGlobals();
  });
});

describe('OnboardingOverlay — anchor robustness', () => {
  it('re-measures the anchor after mount (covers the shop-sheet slide)', () => {
    vi.useFakeTimers();
    const anchor = document.createElement('div');
    anchor.setAttribute('data-onboarding', 'shop-radish');
    document.body.appendChild(anchor);
    const spy = vi.spyOn(anchor, 'getBoundingClientRect');

    render(
      <OnboardingOverlay step="buy-radishes" harvestIncome={0} netIncome={0}
        onStart={noop} onSkip={noop} onDismissPayoff={noop} />,
    );
    const initialCalls = spy.mock.calls.length;
    expect(initialCalls).toBeGreaterThan(0);

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(spy.mock.calls.length).toBeGreaterThan(initialCalls);

    spy.mockRestore();
    document.body.removeChild(anchor);
    vi.useRealTimers();
  });

  it('prefers a visible anchor when duplicates exist', () => {
    // Hidden is appended FIRST so it is els[0]; naive code taking els[0] would
    // measure it. The visible one must be chosen regardless of DOM order.
    const hidden = document.createElement('button');
    hidden.setAttribute('data-onboarding', 'next-day');
    // jsdom: getClientRects() returns [] by default → treated as not visible
    const visible = document.createElement('button');
    visible.setAttribute('data-onboarding', 'next-day');
    visible.getClientRects = () => [{ width: 10, height: 10 } as DOMRect] as unknown as DOMRectList;
    document.body.append(hidden, visible);

    const hiddenSpy = vi.spyOn(hidden, 'getBoundingClientRect');
    const visibleSpy = vi.spyOn(visible, 'getBoundingClientRect');

    const { container } = render(
      <OnboardingOverlay step="advance" harvestIncome={0} netIncome={0}
        onStart={noop} onSkip={noop} onDismissPayoff={noop} />,
    );

    // The visible duplicate is measured; the hidden one is never touched.
    expect(visibleSpy).toHaveBeenCalled();
    expect(hiddenSpy).not.toHaveBeenCalled();
    // Ring renders against the chosen (visible) anchor without throwing.
    expect(container.querySelector('.ring-farm-gold')).toBeTruthy();

    hiddenSpy.mockRestore();
    visibleSpy.mockRestore();
    document.body.removeChild(hidden);
    document.body.removeChild(visible);
  });

  it('re-measures the ring when the anchor element grows (ResizeObserver)', () => {
    // Controllable ResizeObserver so we can fire the resize callback on demand.
    let resizeCb: ResizeObserverCallback | null = null;
    const observed: Element[] = [];
    const OrigRO = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      constructor(cb: ResizeObserverCallback) { resizeCb = cb; }
      observe(el: Element) { observed.push(el); }
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;

    const anchor = document.createElement('div');
    anchor.setAttribute('data-onboarding', 'shop-radish');
    document.body.appendChild(anchor);
    // jsdom returns [] for getClientRects → make the anchor "visible".
    anchor.getClientRects = () => [{ width: 100, height: 50 } as DOMRect] as unknown as DOMRectList;
    let height = 50;
    anchor.getBoundingClientRect = () =>
      ({ top: 100, left: 10, width: 100, height, bottom: 100 + height, right: 110, x: 10, y: 100, toJSON() {} }) as DOMRect;

    const { container } = render(
      <OnboardingOverlay step="buy-radishes" harvestIncome={0} netIncome={0}
        onStart={noop} onSkip={noop} onDismissPayoff={noop} />,
    );

    const ringHeight = () => (container.querySelector('.ring-farm-gold') as HTMLElement).style.height;
    // Ring sized to the initial card height (+12 padding on each measurement).
    expect(ringHeight()).toBe('62px');
    // The overlay observed the anchor for size changes.
    expect(observed).toContain(anchor);

    // Card grows (the Plant button appears after the first purchase) → observer fires.
    height = 92;
    act(() => { resizeCb?.([], {} as ResizeObserver); });
    expect(ringHeight()).toBe('104px');

    globalThis.ResizeObserver = OrigRO;
    document.body.removeChild(anchor);
  });

  it('suppresses a behind-sheet highlight (plant) while the shop sheet is open', () => {
    const grid = document.createElement('div');
    grid.setAttribute('data-onboarding', 'farm-grid');
    grid.getClientRects = () => [{ width: 100, height: 50 } as DOMRect] as unknown as DOMRectList;
    document.body.appendChild(grid);

    const { container, rerender } = render(
      <OnboardingOverlay step="plant" isShopOpen={false} harvestIncome={0} netIncome={0}
        onStart={noop} onSkip={noop} onDismissPayoff={noop} />,
    );
    // Shop closed → the grid is reachable, so its highlight + copy show.
    expect(container.querySelector('.ring-farm-gold')).toBeTruthy();
    expect(container.querySelector('[role="status"]')).toBeTruthy();

    // Shop open → the grid is behind the sheet; the highlight would frame over the
    // shop (the user's z-index complaint), so it is suppressed entirely.
    rerender(
      <OnboardingOverlay step="plant" isShopOpen={true} harvestIncome={0} netIncome={0}
        onStart={noop} onSkip={noop} onDismissPayoff={noop} />,
    );
    expect(container.querySelector('.ring-farm-gold')).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();

    document.body.removeChild(grid);
  });

  it('keeps an in-sheet highlight (buy-radishes) visible while the shop sheet is open', () => {
    const card = document.createElement('div');
    card.setAttribute('data-onboarding', 'shop-radish');
    card.getClientRects = () => [{ width: 100, height: 50 } as DOMRect] as unknown as DOMRectList;
    document.body.appendChild(card);

    const { container } = render(
      <OnboardingOverlay step="buy-radishes" isShopOpen={true} harvestIncome={0} netIncome={0}
        onStart={noop} onSkip={noop} onDismissPayoff={noop} />,
    );
    // The radish card lives inside the sheet, so its highlight must remain.
    expect(container.querySelector('.ring-farm-gold')).toBeTruthy();

    document.body.removeChild(card);
  });
});
