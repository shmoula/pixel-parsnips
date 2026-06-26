import { useLayoutEffect, useState } from 'react';
import type { OnboardingStep } from '../engine/onboarding';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface Props {
  step: OnboardingStep;
  harvestIncome: number;
  onStart: () => void;
  onSkip: () => void;
  onDismissPayoff: () => void;
}

/** Anchor selector + short copy for each anchored step. */
const ANCHORS: Partial<Record<OnboardingStep, { selector: string; copy: string }>> = {
  'open-shop':    { selector: '[data-onboarding="shop-button"]', copy: 'Pop open the shop.' },
  'buy-radishes': { selector: '[data-onboarding="shop-radish"]', copy: 'Radishes sprout overnight — grab one per plot.' },
  'plant':        { selector: '[data-onboarding="farm-grid"]',   copy: 'Fill every plot — more crops, more coins.' },
  'advance':      { selector: '[data-onboarding="next-day"]',    copy: 'Sleep on it — advance a day.' },
};

function useAnchorRect(selector: string | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!selector) { setRect(null); return; }
    const measure = () => {
      const el = document.querySelector(selector);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [selector]);
  return rect;
}

function SkipChip({ onSkip }: { onSkip: () => void }) {
  return (
    <button
      type="button"
      onClick={onSkip}
      aria-label="Skip tutorial"
      className="fixed top-3 right-3 z-[60] font-pixel text-[10px] px-3 py-1.5 rounded
                 bg-farm-ink/90 text-farm-parchment border border-farm-stone/40
                 hover:bg-farm-ink"
    >
      Skip ✕
    </button>
  );
}

export function OnboardingOverlay({ step, harvestIncome, onStart, onSkip, onDismissPayoff }: Props) {
  const reduced = useReducedMotion();
  const anchor = ANCHORS[step] ?? null;
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
            <p className="font-pixel text-sm text-farm-gold">Sold for +{harvestIncome} coins! 🎉</p>
            <p className="font-pixel text-[10px] text-farm-parchment leading-relaxed">
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

      {/* Anchored bubble: open-shop / buy-radishes / plant / advance */}
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
            className="pointer-events-auto absolute max-w-[220px] bg-farm-soil border border-farm-gold/50 rounded-lg px-3 py-2"
            style={
              rect
                ? { left: Math.max(8, rect.left), top: rect.bottom + 10 }
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
