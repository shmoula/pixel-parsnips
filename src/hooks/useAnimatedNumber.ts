import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

/**
 * 021 — displayed integer that ticks toward `target` over `durationMs` when
 * `animate` is true (and the user allows motion); renders `target` immediately
 * otherwise. Retargeting mid-flight animates from the currently displayed
 * value, so a mid-tick balance change (e.g. a purchase) folds in smoothly.
 */
export function useAnimatedNumber(target: number, animate: boolean, durationMs = 800): number {
  const reducedMotion = useReducedMotion();
  const shouldAnimate = animate && !reducedMotion;
  const [displayed, setDisplayed] = useState(target);
  const displayedRef = useRef(target);
  displayedRef.current = displayed;

  useEffect(() => {
    if (!shouldAnimate || displayedRef.current === target) {
      displayedRef.current = target;
      setDisplayed(target);
      return;
    }
    const from = displayedRef.current;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setDisplayed(Math.round(from + (target - from) * t));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, shouldAnimate, durationMs]);

  return displayed;
}
