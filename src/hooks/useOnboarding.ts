import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState } from '../engine/types';
import {
  loadOnboarding,
  saveOnboarding,
  markOnboardingComplete,
  type OnboardingStep,
} from '../engine/onboarding';

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
function emptyPlotCount(state: GameState): number {
  return state.plots
    .slice(0, state.unlockedPlots)
    .filter(p => p.cropId === null && !p.pestDamaged && p.exhaustedSinceDay === null).length;
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
      const needed = Math.max(1, emptyPlotCount(state));
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
    setActive(!rec.completed && state.currentDay <= 1);
    setStep(rec.completed ? 'done' : rec.step);
  }

  // Goal-driven forward advancement for auto steps.
  useEffect(() => {
    if (!active) return;
    const next = deriveStep(step, state, isShopVisible);
    if (next !== step) {
      setStep(next);
      saveOnboarding({ schemaVersion: 1, completed: false, step: next });
    }
  }, [active, step, state, isShopVisible]);

  const onStart = useCallback(() => {
    setStep('open-shop');
    saveOnboarding({ schemaVersion: 1, completed: false, step: 'open-shop' });
  }, []);

  const finish = useCallback(() => {
    markOnboardingComplete();
    setStep('done');
    setActive(false);
  }, []);

  const onSkip = useCallback(finish, [finish]);
  const onDismissPayoff = useCallback(finish, [finish]);

  return {
    active,
    step,
    shouldPinWeather: active && step === 'advance',
    onStart,
    onSkip,
    onDismissPayoff,
  };
}
