import { useLayoutEffect, useState, type CSSProperties } from 'react';
import type { OnboardingStep } from '../engine/onboarding';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { EmojiIcon } from './EmojiIcon';

interface Props {
  step: OnboardingStep;
  /** Gross crop sale from the last day (shown as context). */
  harvestIncome: number;
  /** Net coins that actually landed in the wallet, after lease & tax (the headline). */
  netIncome: number;
  /** True when the mobile shop bottom-sheet is open (covers anchors behind it). */
  isShopOpen?: boolean;
  /** Seed-buying progress for the buy-radishes step: how many bought of how many needed. */
  buyProgress?: { owned: number; needed: number } | null;
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
  'plant':        { selector: '[data-onboarding="empty-plot"]',  copy: 'Fill every plot — more crops, more coins.' },
  'advance':      { selector: '[data-onboarding="next-day"]',    copy: 'Sleep on it — advance a day.' },
};

/** Approximate bubble footprint used for viewport clamping (max-w-[220px] + padding). */
const BUBBLE_WIDTH = 220;
const BUBBLE_HEIGHT = 64;
const EDGE_MARGIN = 8;
/** Breathing room between the anchor's edges and the ring drawn around it. */
const RING_PAD = 6;

/**
 * Top edge of whatever covers this anchor, or null when nothing does. The mobile
 * action bar is fixed to the bottom edge at z-40 while the overlay sits at z-50,
 * so anything drawn past the bar's top edge covers Shop / Next Day. Measured
 * rather than hardcoded: the bar's height varies with env(safe-area-inset-bottom)
 * and it is absent on desktop.
 *
 * The bar only occludes anchors BEHIND it. The open-shop and advance steps anchor
 * to its own buttons, which it cannot cover — those report no occluder, so their
 * ring is padded evenly instead of being clamped (or deleted) against the bar.
 */
function measureOccluderTop(anchorEl: Element | null): number | null {
  const bar = findVisibleAnchor('[data-onboarding="action-bar"]');
  if (!bar || (anchorEl && bar.contains(anchorEl))) return null;
  const rect = bar.getBoundingClientRect();
  return rect.height > 0 ? rect.top : null;
}

/**
 * Centred fallback for when the anchor offers no usable position: pin the bubble
 * just above whatever covers the bottom of the screen so the copy stays readable.
 */
function centeredStyle(occluderTop: number | null): CSSProperties {
  const safeBottom = occluderTop ?? window.innerHeight;
  return { left: '50%', bottom: window.innerHeight - safeBottom + EDGE_MARGIN, transform: 'translateX(-50%)' };
}

/**
 * Place the copy bubble near the anchor while keeping it fully on-screen: clamp the
 * left edge within the viewport, and flip above the anchor when there's no room below.
 */
function bubbleStyle(rect: DOMRect, occluderTop: number | null): CSSProperties {
  const vw = window.innerWidth;
  const safeBottom = occluderTop ?? window.innerHeight;
  // Anchor entirely out of usable space (mid-animation, scrolled away, or behind
  // the action bar).
  if (rect.bottom <= 0 || rect.top >= safeBottom) {
    return centeredStyle(occluderTop);
  }
  const left = Math.min(
    Math.max(EDGE_MARGIN, rect.left),
    Math.max(EDGE_MARGIN, vw - BUBBLE_WIDTH - EDGE_MARGIN),
  );
  const fitsBelow = rect.bottom + 10 + BUBBLE_HEIGHT + EDGE_MARGIN <= safeBottom;
  return fitsBelow
    ? { left, top: rect.bottom + 10 }
    : { left, top: rect.top - 10, transform: 'translateY(-100%)' };
}

/**
 * Ring box padded evenly around the anchor. When something covers the anchor the
 * ring is cut off above it, and returns null if no drawable height survives (the
 * anchor is fully behind it) — an anchor can be taller than the free viewport, in
 * which case the ring ends at the occluder. With nothing in the way the padding
 * stays even, so a button at the very bottom of the screen keeps its full frame.
 */
function ringStyle(rect: DOMRect, occluderTop: number | null): CSSProperties | null {
  const top = rect.top - RING_PAD;
  const padded = rect.bottom + RING_PAD;
  const bottom = occluderTop === null ? padded : Math.min(padded, occluderTop - EDGE_MARGIN);
  if (bottom <= top) return null;
  return { left: rect.left - RING_PAD, top, width: rect.width + RING_PAD * 2, height: bottom - top };
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

interface AnchorGeometry {
  rect: DOMRect | null;
  /** Top edge of the element covering the anchor, or null when nothing does. */
  occluderTop: number | null;
}

/**
 * Continuously tracks the anchor's rect and the usable bottom edge with a
 * requestAnimationFrame loop while a step is anchored. This follows transform
 * transitions (the mobile shop sheet's 300ms slide-up), scrolls, and resizes
 * without event bookkeeping — fixed re-measure timers missed the sheet's final
 * position (017 FR-001/FR-002). The setter bails out when nothing moved, so idle
 * frames cause no re-renders.
 */
function useAnchorGeometry(selector: string | null): AnchorGeometry {
  const [geom, setGeom] = useState<AnchorGeometry>(() => ({ rect: null, occluderTop: null }));
  useLayoutEffect(() => {
    if (!selector) {
      setGeom({ rect: null, occluderTop: null });
      return;
    }
    let raf = 0;
    const measure = () => {
      const el = findVisibleAnchor(selector);
      const rect = el ? el.getBoundingClientRect() : null;
      const occluderTop = measureOccluderTop(el);
      setGeom(prev =>
        sameRect(prev.rect, rect) && prev.occluderTop === occluderTop ? prev : { rect, occluderTop },
      );
      raf = requestAnimationFrame(measure);
    };
    // Measure synchronously before first paint (so the highlight appears
    // immediately on mount) — the rAF loop then keeps it in sync every frame.
    measure();
    return () => cancelAnimationFrame(raf);
  }, [selector]);
  return geom;
}

/** 017 FR-005 — live seed-buying progress shown under the buy-radishes copy. */
function BuyProgress({ step, buyProgress }: { step: OnboardingStep; buyProgress: Props['buyProgress'] }) {
  if (step !== 'buy-radishes' || !buyProgress) return null;
  return (
    <p className="font-pixel text-caption text-farm-gold mt-1">
      {buyProgress.owned} of {buyProgress.needed} bought
    </p>
  );
}

/** The highlight ring + copy bubble anchored to the current step's on-screen target. */
function AnchoredBubble({
  anchor,
  rect,
  occluderTop,
  step,
  buyProgress,
  ringPulse,
}: {
  anchor: { selector: string; copy: string };
  rect: DOMRect | null;
  occluderTop: number | null;
  step: OnboardingStep;
  buyProgress: Props['buyProgress'];
  ringPulse: string;
}) {
  const ring = rect ? ringStyle(rect, occluderTop) : null;
  return (
    <>
      {ring && (
        <div
          aria-hidden="true"
          className={`absolute rounded-lg ring-2 ring-farm-gold ${ringPulse}`}
          style={ring}
        />
      )}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto absolute max-w-[220px] bg-farm-soil border border-farm-gold/50 rounded-lg px-3 py-2"
        style={rect ? bubbleStyle(rect, occluderTop) : centeredStyle(occluderTop)}
      >
        <p className="font-pixel text-caption text-farm-parchment leading-relaxed">{anchor.copy}</p>
        <BuyProgress step={step} buyProgress={buyProgress} />
      </div>
    </>
  );
}

function SkipChip({ onSkip }: { onSkip: () => void }) {
  return (
    <button
      type="button"
      onClick={onSkip}
      aria-label="Skip tutorial"
      className="fixed bottom-20 right-3 md:bottom-3 z-[60] font-pixel text-caption px-3 py-1.5 rounded
                 pointer-events-auto
                 bg-farm-ink/90 text-farm-parchment border border-farm-stone/40
                 hover:bg-farm-ink"
    >
      Skip <span aria-hidden="true">✕</span>
    </button>
  );
}

export function OnboardingOverlay({ step, harvestIncome, netIncome, isShopOpen = false, buyProgress = null, onStart, onSkip, onDismissPayoff }: Props) {
  const reduced = useReducedMotion();
  const anchor = activeAnchor(step, isShopOpen);
  const { rect, occluderTop } = useAnchorGeometry(anchor ? anchor.selector : null);

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
            <p className="font-pixel text-body text-farm-parchment leading-relaxed">
              Grow crops. Sell 'em. Don't go broke. Let's fill your farm with radishes!
            </p>
            <button
              type="button"
              onClick={onStart}
              className="font-pixel text-body px-4 py-2 rounded bg-farm-grass text-farm-parchment hover:bg-farm-gold hover:text-farm-ink"
            >
              <EmojiIcon>🌱</EmojiIcon> Plant my farm
            </button>
          </div>
        </div>
      )}

      {/* Centered card: payoff */}
      {step === 'payoff' && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <div className="pointer-events-auto max-w-xs w-full bg-farm-soil border border-farm-gold/50 rounded-xl p-5 flex flex-col gap-4 text-center">
            <p className="font-pixel text-title text-farm-gold">+{netIncome} coins profit! 🎉</p>
            <p className="font-pixel text-caption text-farm-parchment leading-relaxed">
              Sold your radishes for {harvestIncome} — lease &amp; tax took the rest.
              That's the loop. Now hit your season target.
            </p>
            <button
              type="button"
              onClick={onDismissPayoff}
              className="font-pixel text-body px-4 py-2 rounded bg-farm-grass text-farm-parchment hover:bg-farm-gold hover:text-farm-ink"
            >
              Got it →
            </button>
          </div>
        </div>
      )}

      {/* Anchored bubble: open-shop / buy-radishes / plant / advance.
          activeAnchor() returns null while the shop sheet covers this anchor. */}
      {anchor && (
        <AnchoredBubble anchor={anchor} rect={rect} occluderTop={occluderTop} step={step} buyProgress={buyProgress} ringPulse={ringPulse} />
      )}
    </div>
  );
}
