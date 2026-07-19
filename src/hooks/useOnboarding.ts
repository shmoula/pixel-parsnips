import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState } from '../engine/types';
import {
  loadOnboarding,
  saveOnboarding,
  markOnboardingComplete,
  ONBOARDING_STEPS,
  type OnboardingStep,
} from '../engine/onboarding';
import { track } from '../analytics/track';
import type { OnboardingFunnelStep } from '../analytics/events';

export interface UseOnboardingResult {
  active: boolean;
  step: OnboardingStep;
  shouldPinWeather: boolean;
  onStart: () => void;
  onSkip: () => void;
  onDismissPayoff: () => void;
}

interface Opts {
  /** True when the shop is on-screen (always true on desktop sidebar; mobile sheet open). */
  isShopVisible: boolean;
}

/** Count of unlocked, plantable (empty / not pest / not exhausted) plots. */
export function emptyPlotCount(state: GameState): number {
  return state.plots
    .slice(0, state.unlockedPlots)
    .filter(p => p.cropId === null && !p.pestDamaged && p.exhaustedSinceDay === null).length;
}

/**
 * Radishes needed to satisfy the buy-radishes step: one per open plot, floored at 1.
 * The floor matters because if every unlocked plot happens to be pest-damaged or
 * exhausted when the tutorial starts, `emptyPlotCount` returns 0 — without the floor
 * the step would either "complete" with zero radishes bought, or the progress display
 * would read "X of 0 bought". Shared by `deriveStep` (step-advance gate) and
 * `GameBoard`'s progress display so the two can never desync.
 */
export function buyRadishesNeeded(state: GameState): number {
  return Math.max(1, emptyPlotCount(state));
}

/**
 * Forward-only goal evaluation: given the current step and live state, return the
 * furthest AUTO step now justified. Manual gates (welcome, payoff) are returned as-is.
 */
function deriveStep(step: OnboardingStep, state: GameState, isShopVisible: boolean): OnboardingStep {
  let s = step;
  // Cascade: each satisfied goal moves to the next step; manual steps stop the cascade.
  while (true) {
    if (s === 'open-shop' && isShopVisible) { s = 'buy-radishes'; continue; }
    if (s === 'buy-radishes') {
      const needed = buyRadishesNeeded(state);
      if (state.seedInventory.radish >= needed) { s = 'plant'; continue; }
    }
    if (s === 'plant' && emptyPlotCount(state) === 0) { s = 'advance'; continue; }
    if (s === 'advance' && state.lastDailyLog !== null) { s = 'payoff'; continue; }
    return s;
  }
}

export function useOnboarding(state: GameState, { isShopVisible }: Opts): UseOnboardingResult {
  // One-time init: decide whether the tutorial runs at all.
  const initRef = useRef(false);
  const [active, setActive] = useState(false);
  const [step, setStep] = useState<OnboardingStep>('welcome');
  // Highest ONBOARDING_STEPS index already emitted as onboarding_step_reached.
  // Every emission path walks from ref + 1 to its target, so cascade jumps emit
  // intermediates, resume never re-emits earlier steps, and StrictMode's double
  // effect invocation is a no-op on the second pass.
  const emittedThroughRef = useRef(ONBOARDING_STEPS.length - 1);

  if (!initRef.current) {
    initRef.current = true;
    const rec = loadOnboarding();
    if (rec.completed) {
      // already done — stay inactive
    } else if (state.currentDay > 1) {
      // Pre-feature run already in progress — never yank into a tutorial.
      markOnboardingComplete();
    } else {
      // Fresh first run.
      // (setState during render init is fine; React applies before commit.)
    }
    const willBeActive = !rec.completed && state.currentDay <= 1;
    setActive(willBeActive);
    setStep(rec.completed ? 'done' : rec.step);
    // 'welcome' (the default/replayed record) starts below 0 so the entry step
    // emits; resuming at a later step counts that step as already emitted.
    emittedThroughRef.current = !willBeActive
      ? ONBOARDING_STEPS.length - 1
      : rec.step === 'welcome' ? -1 : ONBOARDING_STEPS.indexOf(rec.step);
  }

  const emitStepsThrough = useCallback((toIndex: number) => {
    for (let i = emittedThroughRef.current + 1; i <= toIndex; i++) {
      const s = ONBOARDING_STEPS[i];
      if (s === 'done') break; // terminal outcome is onboarding_completed/_skipped, never a step
      track('onboarding_step_reached', { step: s as OnboardingFunnelStep, step_index: i });
    }
    if (toIndex > emittedThroughRef.current) emittedThroughRef.current = toIndex;
  }, []);

  // welcome — the entry step of a fresh (or replayed) tutorial pass.
  useEffect(() => {
    if (active && step === 'welcome') emitStepsThrough(0);
  }, [active, step, emitStepsThrough]);

  // Goal-driven forward advancement for auto steps.
  useEffect(() => {
    if (!active) return;
    const next = deriveStep(step, state, isShopVisible);
    if (next !== step) {
      emitStepsThrough(ONBOARDING_STEPS.indexOf(next));
      setStep(next);
      saveOnboarding({ schemaVersion: 1, completed: false, step: next });
    }
  }, [active, step, state, isShopVisible, emitStepsThrough]);

  const onStart = useCallback(() => {
    emitStepsThrough(1);
    setStep('open-shop');
    saveOnboarding({ schemaVersion: 1, completed: false, step: 'open-shop' });
  }, [emitStepsThrough]);

  const finish = useCallback(() => {
    markOnboardingComplete();
    setStep('done');
    setActive(false);
  }, []);

  const onSkip = useCallback(() => {
    // step can't be 'done' here: finish() deactivates before the overlay unmounts.
    track('onboarding_skipped', {
      from_step: step as OnboardingFunnelStep,
      from_step_index: ONBOARDING_STEPS.indexOf(step),
    });
    finish();
  }, [step, finish]);

  const onDismissPayoff = useCallback(() => {
    track('onboarding_completed', {});
    finish();
  }, [finish]);

  return {
    active,
    step,
    shouldPinWeather: active && step === 'advance',
    onStart,
    onSkip,
    onDismissPayoff,
  };
}
