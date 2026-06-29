import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OnboardingOverlay } from '../../src/components/OnboardingOverlay';

const noop = () => {};

describe('OnboardingOverlay', () => {
  it('shows the welcome copy and a start CTA', () => {
    render(
      <OnboardingOverlay step="welcome" harvestIncome={0}
        onStart={noop} onSkip={noop} onDismissPayoff={noop} />,
    );
    expect(screen.getByText(/fill your farm with radishes/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /plant/i })).toBeInTheDocument();
  });

  it('fires onStart from the welcome CTA', () => {
    const onStart = vi.fn();
    render(
      <OnboardingOverlay step="welcome" harvestIncome={0}
        onStart={onStart} onSkip={noop} onDismissPayoff={noop} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /plant/i }));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it('always shows a Skip control', () => {
    render(
      <OnboardingOverlay step="buy-radishes" harvestIncome={0}
        onStart={noop} onSkip={noop} onDismissPayoff={noop} />,
    );
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
  });

  it('shows the harvest income and a dismiss CTA on payoff', () => {
    const onDismiss = vi.fn();
    render(
      <OnboardingOverlay step="payoff" harvestIncome={48}
        onStart={noop} onSkip={noop} onDismissPayoff={onDismiss} />,
    );
    expect(screen.getByText(/\+48/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /got it|continue|hit your/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('renders the step copy for an anchored step even when the anchor is absent', () => {
    render(
      <OnboardingOverlay step="plant" harvestIncome={0}
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
      <OnboardingOverlay step="advance" harvestIncome={0}
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
      <OnboardingOverlay step="advance" harvestIncome={0}
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
      <OnboardingOverlay step="buy-radishes" harvestIncome={0}
        onStart={noop} onSkip={noop} onDismissPayoff={noop} />,
    );
    const initialCalls = spy.mock.calls.length;
    expect(initialCalls).toBeGreaterThan(0);

    vi.advanceTimersByTime(400);
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
      <OnboardingOverlay step="advance" harvestIncome={0}
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
});
