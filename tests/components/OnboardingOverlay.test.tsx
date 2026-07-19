import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { OnboardingOverlay } from '../../src/components/OnboardingOverlay';

const noop = () => {};

/**
 * Stubs requestAnimationFrame/cancelAnimationFrame with a manual queue and
 * returns a `flushFrame` that runs (and clears) all queued callbacks inside
 * `act`. Call `vi.unstubAllGlobals()` afterwards to restore. Shared by every
 * rAF-driven anchor-tracking test below.
 */
function installRafStub(): () => void {
  let rafQueue: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafQueue.push(cb);
    return rafQueue.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  return () => {
    const q = rafQueue;
    rafQueue = [];
    q.forEach(cb => act(() => cb(0)));
  };
}

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
    const flushFrame = installRafStub();

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

    flushFrame();
    flushFrame();
    flushFrame();
    expect(spy.mock.calls.length).toBeGreaterThan(initialCalls);

    spy.mockRestore();
    document.body.removeChild(anchor);
    vi.unstubAllGlobals();
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

  it('re-measures the ring when the anchor element grows (rAF polling)', () => {
    const flushFrame = installRafStub();

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

    // Card grows (the Plant button appears after the first purchase) → the next
    // polled frame picks up the new size without any observer plumbing.
    height = 92;
    flushFrame();
    expect(ringHeight()).toBe('104px');

    vi.unstubAllGlobals();
    document.body.removeChild(anchor);
  });

  it('suppresses a behind-sheet highlight (plant) while the shop sheet is open', () => {
    const plot = document.createElement('button');
    plot.setAttribute('data-onboarding', 'empty-plot');
    plot.getClientRects = () => [{ width: 100, height: 50 } as DOMRect] as unknown as DOMRectList;
    document.body.appendChild(plot);

    const { container, rerender } = render(
      <OnboardingOverlay step="plant" isShopOpen={false} harvestIncome={0} netIncome={0}
        onStart={noop} onSkip={noop} onDismissPayoff={noop} />,
    );
    // Shop closed → the plot is reachable, so its highlight + copy show.
    expect(container.querySelector('.ring-farm-gold')).toBeTruthy();
    expect(container.querySelector('[role="status"]')).toBeTruthy();

    // Shop open → the plot is behind the sheet; the highlight would frame over the
    // shop (the user's z-index complaint), so it is suppressed entirely.
    rerender(
      <OnboardingOverlay step="plant" isShopOpen={true} harvestIncome={0} netIncome={0}
        onStart={noop} onSkip={noop} onDismissPayoff={noop} />,
    );
    expect(container.querySelector('.ring-farm-gold')).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();

    document.body.removeChild(plot);
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

describe('OnboardingOverlay — live anchor tracking (017 FR-001/FR-002)', () => {
  let flushFrame: () => void;

  beforeEach(() => {
    flushFrame = installRafStub();
  });
  afterEach(() => vi.unstubAllGlobals());

  function stubAnchor(rect: Partial<DOMRect>) {
    const el = document.createElement('div');
    el.setAttribute('data-onboarding', 'shop-radish');
    el.getBoundingClientRect = () =>
      ({ x: 0, y: 0, top: 0, bottom: 0, left: 0, right: 0, width: 100, height: 40, ...rect }) as DOMRect;
    // findVisibleAnchor requires a non-empty client rect list
    el.getClientRects = () => [{}] as unknown as DOMRectList;
    document.body.appendChild(el);
    return el;
  }

  it('follows the anchor when it moves after mount (e.g. sheet slide-up)', () => {
    const el = stubAnchor({ top: 900, bottom: 940, left: 10, right: 110 });
    const { container } = render(
      <OnboardingOverlay step="buy-radishes" harvestIncome={0} netIncome={0}
        onStart={noop} onSkip={noop} onDismissPayoff={noop} />,
    );
    flushFrame(); // initial measure: anchor off-screen at top 900

    // Sheet finishes animating: anchor now on-screen
    el.getBoundingClientRect = () =>
      ({ x: 10, y: 300, top: 300, bottom: 340, left: 10, right: 110, width: 100, height: 40 }) as DOMRect;
    flushFrame(); // next frame picks up the new position

    const ring = container.querySelector('.ring-farm-gold') as HTMLElement;
    expect(ring.style.top).toBe('294px'); // rect.top − 6

    document.body.removeChild(el);
  });

  it('hides the highlight and copy while the anchor is scrolled fully out of the viewport', () => {
    // Anchor sits below the fold (top 900 > the 768 jsdom viewport height).
    const el = stubAnchor({ top: 900, bottom: 940, left: 10, right: 110 });
    const { container } = render(
      <OnboardingOverlay step="buy-radishes" harvestIncome={0} netIncome={0}
        onStart={noop} onSkip={noop} onDismissPayoff={noop} />,
    );
    flushFrame(); // measure: target off-screen

    // "Hide until visible" — no detached bottom-center bubble, no stale off-screen ring.
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector('.ring-farm-gold')).toBeNull();

    // Scroll it back into view → highlight + copy return.
    el.getBoundingClientRect = () =>
      ({ x: 10, y: 300, top: 300, bottom: 340, left: 10, right: 110, width: 100, height: 40 }) as DOMRect;
    flushFrame();
    expect(container.querySelector('[role="status"]')).toBeTruthy();
    expect(container.querySelector('.ring-farm-gold')).toBeTruthy();

    document.body.removeChild(el);
  });
});

describe('OnboardingOverlay — skip chip positioning (017 FR-003)', () => {
  it('positions the skip chip above the mobile bottom bar (017 FR-003)', () => {
    render(
      <OnboardingOverlay step="welcome" harvestIncome={0} netIncome={0}
        onStart={() => {}} onSkip={() => {}} onDismissPayoff={() => {}} />,
    );
    const skip = screen.getByRole('button', { name: /skip tutorial/i });
    expect(skip.className).toContain('bottom-20');
    expect(skip.className).toContain('md:bottom-3');
  });
});

/**
 * The mobile bottom action bar is `fixed bottom-0` and the overlay sits above it
 * at z-50, so an anchor taller than the free viewport (the farm grid, and any
 * future tall anchor) would draw its ring straight over Shop / Skip Day. The
 * overlay measures the bar and treats its top edge as the bottom of usable space.
 */
describe('OnboardingOverlay — action-bar clamping', () => {
  const VIEWPORT_HEIGHT = 812;
  const BAR_TOP = 720;
  /** Mirrors RING_PAD in OnboardingOverlay: padding between anchor and ring. */
  const RING_PAD = 6;

  beforeEach(() => {
    vi.stubGlobal('innerHeight', VIEWPORT_HEIGHT);
    vi.stubGlobal('innerWidth', 375);
  });
  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  /** Mount a stand-in for the fixed BottomActionBar with its top edge at BAR_TOP. */
  function mountActionBar() {
    const bar = document.createElement('div');
    bar.setAttribute('data-onboarding', 'action-bar');
    bar.getClientRects = () => [{}] as unknown as DOMRectList;
    bar.getBoundingClientRect = () =>
      ({ x: 0, y: BAR_TOP, top: BAR_TOP, bottom: VIEWPORT_HEIGHT, left: 0, right: 375,
         width: 375, height: VIEWPORT_HEIGHT - BAR_TOP, toJSON() {} }) as DOMRect;
    document.body.appendChild(bar);
    return bar;
  }

  /** Mount the plant-step anchor with the given viewport rect. */
  function mountPlotAnchor(rect: Partial<DOMRect>) {
    const el = document.createElement('button');
    el.setAttribute('data-onboarding', 'empty-plot');
    el.getClientRects = () => [{}] as unknown as DOMRectList;
    el.getBoundingClientRect = () =>
      ({ x: 0, y: 0, top: 0, bottom: 0, left: 10, right: 110, width: 100, height: 40,
         toJSON() {}, ...rect }) as DOMRect;
    document.body.appendChild(el);
    return el;
  }

  const renderPlant = () =>
    render(
      <OnboardingOverlay step="plant" harvestIncome={0} netIncome={0}
        onStart={noop} onSkip={noop} onDismissPayoff={noop} />,
    );

  it('ends the highlight ring above the action bar when the anchor runs past it', () => {
    mountActionBar();
    // Anchor extends well below the bar's top edge (a tall grid on a short screen).
    mountPlotAnchor({ top: 400, bottom: 1100, height: 700 });

    const { container } = renderPlant();
    const ring = container.querySelector('.ring-farm-gold') as HTMLElement;

    const ringTop = parseFloat(ring.style.top);
    const ringBottom = ringTop + parseFloat(ring.style.height);
    expect(ringBottom).toBeLessThanOrEqual(BAR_TOP);
  });

  it('leaves a ring that already fits above the bar unclamped', () => {
    mountActionBar();
    mountPlotAnchor({ top: 300, bottom: 340, height: 40 });

    const { container } = renderPlant();
    const ring = container.querySelector('.ring-farm-gold') as HTMLElement;

    expect(ring.style.top).toBe('294px');    // rect.top − 6
    expect(ring.style.height).toBe('52px');  // rect.height + 12
  });

  it('drops the ring entirely when the anchor sits fully behind the action bar', () => {
    mountActionBar();
    mountPlotAnchor({ top: 760, bottom: 800, height: 40 });

    const { container } = renderPlant();
    expect(container.querySelector('.ring-farm-gold')).toBeNull();
  });

  /**
   * The open-shop / advance steps anchor to buttons that live INSIDE the action
   * bar. The bar cannot occlude its own children, so those rings must survive the
   * clamp — clamping them away leaves the step with a bubble and no highlight.
   */
  it('keeps the ring on an anchor that lives inside the action bar', () => {
    const bar = mountActionBar();
    const button = document.createElement('button');
    button.setAttribute('data-onboarding', 'shop-button');
    button.getClientRects = () => [{}] as unknown as DOMRectList;
    button.getBoundingClientRect = () =>
      ({ x: 12, y: 740, top: 740, bottom: 784, left: 12, right: 180, width: 168, height: 44,
         toJSON() {} }) as DOMRect;
    bar.appendChild(button);

    const { container } = render(
      <OnboardingOverlay step="open-shop" harvestIncome={0} netIncome={0}
        onStart={noop} onSkip={noop} onDismissPayoff={noop} />,
    );
    const ring = container.querySelector('.ring-farm-gold') as HTMLElement;

    expect(ring).toBeTruthy();
    // Framed around the button itself, not cut off at the bar it sits in.
    expect(ring.style.top).toBe('734px');   // rect.top − 6
    expect(ring.style.height).toBe('56px'); // rect.height + 12
  });

  it('pads an in-bar ring evenly even when the button sits at the viewport edge', () => {
    const bar = mountActionBar();
    // Mirrors the real Next Day button: flush against the bottom of the screen,
    // so a viewport-edge clamp would shave the ring's bottom padding to nothing.
    const button = document.createElement('button');
    button.setAttribute('data-onboarding', 'shop-button');
    button.getClientRects = () => [{}] as unknown as DOMRectList;
    button.getBoundingClientRect = () =>
      ({ x: 12, y: 760, top: 760, bottom: 804, left: 12, right: 180, width: 168, height: 44,
         toJSON() {} }) as DOMRect;
    bar.appendChild(button);

    const { container } = render(
      <OnboardingOverlay step="open-shop" harvestIncome={0} netIncome={0}
        onStart={noop} onSkip={noop} onDismissPayoff={noop} />,
    );
    const ring = container.querySelector('.ring-farm-gold') as HTMLElement;
    const top = parseFloat(ring.style.top);
    const bottom = top + parseFloat(ring.style.height);

    // Equal 6px breathing room above and below — no lopsided frame.
    expect(760 - top).toBe(RING_PAD);
    expect(bottom - 804).toBe(RING_PAD);
  });

  it('flips the copy bubble above an anchor when only the action bar is below it', () => {
    mountActionBar();
    // 64px of bubble + margin fits under rect.bottom within the 812px viewport,
    // but NOT within the 720px of space the action bar leaves.
    mountPlotAnchor({ top: 620, bottom: 660, height: 40 });

    const { container } = renderPlant();
    const bubble = container.querySelector('[role="status"]') as HTMLElement;

    expect(bubble.style.top).toBe('610px'); // rect.top − 10, flipped up
    expect(bubble.style.transform).toContain('translateY(-100%)');
  });
});

describe('OnboardingOverlay — buy progress (017 FR-005)', () => {
  it('shows buy progress during the buy-radishes step (017 FR-005)', () => {
    render(
      <OnboardingOverlay step="buy-radishes" harvestIncome={0} netIncome={0}
        buyProgress={{ owned: 2, needed: 4 }}
        onStart={() => {}} onSkip={() => {}} onDismissPayoff={() => {}} />,
    );
    expect(screen.getByText('2 of 4 bought')).toBeInTheDocument();
  });

  it('renders no buy-progress text when buyProgress is omitted', () => {
    render(
      <OnboardingOverlay step="buy-radishes" harvestIncome={0} netIncome={0}
        onStart={() => {}} onSkip={() => {}} onDismissPayoff={() => {}} />,
    );
    expect(screen.queryByText(/bought/)).not.toBeInTheDocument();
  });
});
