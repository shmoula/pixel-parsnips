import { useLayoutEffect, useState, type CSSProperties } from 'react';
import type { OnboardingStep } from '../engine/onboarding';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface Props {
  step: OnboardingStep;
  /** Gross crop sale from the last day (shown as context). */
  harvestIncome: number;
  /** Net coins that actually landed in the wallet, after lease & tax (the headline). */
  netIncome: number;
  /** True when the mobile shop bottom-sheet is open (covers anchors behind it). */
  isShopOpen?: boolean;
  onStart: () => void;
  onSkip: () => void;
  onDismissPayoff: () => void;
}

/**
 * Anchor selector + short copy for each anchored step. `inShopSheet` marks anchors
 * that live INSIDE the mobile shop sheet (so they stay highlightable while it's open);
 * all other anchors sit behind the sheet and their highlight is suppressed when it opens.
 */
const ANCHORS: Partial<Record<OnboardingStep, { selector: string; copy: string; inShopSheet?: boolean }>> = {
  'open-shop':    { selector: '[data-onboarding="shop-button"]', copy: 'Pop open the shop.' },
  'buy-radishes': { selector: '[data-onboarding="shop-radish"]', copy: 'Radishes sprout overnight — grab 4, one for each open plot.', inShopSheet: true },
  'plant':        { selector: '[data-onboarding="farm-grid"]',   copy: 'Fill every plot — more crops, more coins.' },
  'advance':      { selector: '[data-onboarding="next-day"]',    copy: 'Sleep on it — advance a day.' },
};

/** Approximate bubble footprint used for viewport clamping (max-w-[220px] + padding). */
const BUBBLE_WIDTH = 220;
const BUBBLE_HEIGHT = 64;
const EDGE_MARGIN = 8;

/**
 * Place the copy bubble near the anchor while keeping it fully on-screen: clamp the
 * left edge within the viewport, and flip above the anchor when there's no room below.
 */
function bubbleStyle(rect: DOMRect): CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Anchor entirely off-screen (e.g. mid-animation or scrolled away): pin the
  // bubble above the bottom action bar so the instruction stays readable.
  if (rect.bottom <= 0 || rect.top >= vh) {
    return { left: '50%', bottom: 88, transform: 'translateX(-50%)' };
  }
  const left = Math.min(
    Math.max(EDGE_MARGIN, rect.left),
    Math.max(EDGE_MARGIN, vw - BUBBLE_WIDTH - EDGE_MARGIN),
  );
  const fitsBelow = rect.bottom + 10 + BUBBLE_HEIGHT + EDGE_MARGIN <= vh;
  return fitsBelow
    ? { left, top: rect.bottom + 10 }
    : { left, top: rect.top - 10, transform: 'translateY(-100%)' };
}

/**
 * The anchor whose highlight should currently render, or null. While the mobile
 * shop sheet is open it covers every anchor except the radish card inside it, so
 * behind-sheet anchors (the farm grid, the bottom bar) are suppressed — otherwise
 * their frame would draw over the shop at the overlay's higher z-index.
 */
function activeAnchor(step: OnboardingStep, isShopOpen: boolean) {
  const anchor = ANCHORS[step] ?? null;
  if (!anchor) return null;
  if (isShopOpen && !anchor.inShopSheet) return null;
  return anchor;
}

/** Among all elements matching the selector, prefer one that is actually rendered. */
function findVisibleAnchor(selector: string): Element | null {
  const els = Array.from(document.querySelectorAll(selector));
  return els.find(el => el.getClientRects().length > 0) ?? els[0] ?? null;
}

/** True when two rects are identical enough to skip a state update. */
function sameRect(a: DOMRect | null, b: DOMRect | null): boolean {
  if (a === null || b === null) return a === b;
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
}

/**
 * Continuously tracks the anchor's rect with a requestAnimationFrame loop while
 * a step is anchored. This follows transform transitions (the mobile shop
 * sheet's 300ms slide-up), scrolls, and resizes without event bookkeeping —
 * fixed re-measure timers missed the sheet's final position (017 FR-001/FR-002).
 * setRect bails out via sameRect, so idle frames cause no re-renders.
 */
function useAnchorRect(selector: string | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }
    let raf = 0;
    const measure = () => {
      const el = findVisibleAnchor(selector);
      const next = el ? el.getBoundingClientRect() : null;
      setRect(prev => (sameRect(prev, next) ? prev : next));
      raf = requestAnimationFrame(measure);
    };
    // Measure synchronously before first paint (so the highlight appears
    // immediately on mount) — the rAF loop then keeps it in sync every frame.
    measure();
    return () => cancelAnimationFrame(raf);
  }, [selector]);
  return rect;
}

function SkipChip({ onSkip }: { onSkip: () => void }) {
  return (
    <button
      type="button"
      onClick={onSkip}
      aria-label="Skip tutorial"
      className="fixed bottom-3 right-3 z-[60] font-pixel text-[10px] px-3 py-1.5 rounded
                 pointer-events-auto
                 bg-farm-ink/90 text-farm-parchment border border-farm-stone/40
                 hover:bg-farm-ink"
    >
      Skip <span aria-hidden="true">✕</span>
    </button>
  );
}

export function OnboardingOverlay({ step, harvestIncome, netIncome, isShopOpen = false, onStart, onSkip, onDismissPayoff }: Props) {
  const reduced = useReducedMotion();
  const anchor = activeAnchor(step, isShopOpen);
  const rect = useAnchorRect(anchor ? anchor.selector : null);

  if (step === 'done') return null;

  const ringPulse = reduced ? '' : 'animate-pulse';

  return (
    <div role="dialog" aria-label="Tutorial" className="fixed inset-0 z-50 pointer-events-none">
      {/* gentle dim — does not block clicks (soft focus) */}
      <div className="absolute inset-0 bg-black/30" aria-hidden="true" />
      <SkipChip onSkip={onSkip} />

      {/* Centered card: welcome */}
      {step === 'welcome' && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="pointer-events-auto max-w-xs w-full bg-farm-soil border border-farm-stone/40 rounded-xl p-5 flex flex-col gap-4 text-center">
            <p className="font-pixel text-xs text-farm-parchment leading-relaxed">
              Grow crops. Sell 'em. Don't go broke. Let's fill your farm with radishes!
            </p>
            <button
              type="button"
              onClick={onStart}
              className="font-pixel text-xs px-4 py-2 rounded bg-farm-grass text-farm-parchment hover:bg-farm-gold hover:text-farm-ink"
            >
              🌱 Plant my farm
            </button>
          </div>
        </div>
      )}

      {/* Centered card: payoff */}
      {step === 'payoff' && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="pointer-events-auto max-w-xs w-full bg-farm-soil border border-farm-gold/50 rounded-xl p-5 flex flex-col gap-4 text-center">
            <p className="font-pixel text-sm text-farm-gold">+{netIncome} coins profit! 🎉</p>
            <p className="font-pixel text-[10px] text-farm-parchment leading-relaxed">
              Sold your radishes for {harvestIncome} — lease &amp; tax took the rest.
              That's the loop. Now hit your season target.
            </p>
            <button
              type="button"
              onClick={onDismissPayoff}
              className="font-pixel text-xs px-4 py-2 rounded bg-farm-grass text-farm-parchment hover:bg-farm-gold hover:text-farm-ink"
            >
              Got it →
            </button>
          </div>
        </div>
      )}

      {/* Anchored bubble: open-shop / buy-radishes / plant / advance.
          activeAnchor() returns null while the shop sheet covers this anchor. */}
      {anchor && (
        <>
          {rect && (
            <div
              aria-hidden="true"
              className={`absolute rounded-lg ring-2 ring-farm-gold ${ringPulse}`}
              style={{
                left: rect.left - 6,
                top: rect.top - 6,
                width: rect.width + 12,
                height: rect.height + 12,
              }}
            />
          )}
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-auto absolute max-w-[220px] bg-farm-soil border border-farm-gold/50 rounded-lg px-3 py-2"
            style={
              rect
                ? bubbleStyle(rect)
                : { left: '50%', bottom: 24, transform: 'translateX(-50%)' }
            }
          >
            <p className="font-pixel text-[10px] text-farm-parchment leading-relaxed">{anchor.copy}</p>
          </div>
        </>
      )}
    </div>
  );
}
