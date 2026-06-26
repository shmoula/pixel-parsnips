export const ONBOARDING_KEY = 'pixel-parsnips-onboarding';

/** Ordered steps of the first-run guided flow. */
export type OnboardingStep =
  | 'welcome'
  | 'open-shop'
  | 'buy-radishes'
  | 'plant'
  | 'advance'
  | 'payoff'
  | 'done';

const STEPS: readonly OnboardingStep[] = [
  'welcome', 'open-shop', 'buy-radishes', 'plant', 'advance', 'payoff', 'done',
];

export interface OnboardingRecord {
  schemaVersion: 1;
  /** True once the player finishes or skips the tutorial; survives Restart. */
  completed: boolean;
  /** Furthest step reached, for resume-on-refresh. */
  step: OnboardingStep;
}

const DEFAULT_RECORD: OnboardingRecord = { schemaVersion: 1, completed: false, step: 'welcome' };

function isStep(v: unknown): v is OnboardingStep {
  return typeof v === 'string' && (STEPS as readonly string[]).includes(v);
}

/** Returns defaults when missing or malformed; never throws. */
export function loadOnboarding(): OnboardingRecord {
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);
    if (!raw) return { ...DEFAULT_RECORD };
    const parsed = JSON.parse(raw) as Partial<OnboardingRecord>;
    return {
      schemaVersion: 1,
      completed: parsed.completed === true,
      step: isStep(parsed.step) ? parsed.step : 'welcome',
    };
  } catch {
    return { ...DEFAULT_RECORD };
  }
}

export function saveOnboarding(rec: OnboardingRecord): void {
  try {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify(rec));
  } catch {
    // Storage full or disabled — non-fatal; onboarding simply won't persist.
  }
}

/** Mark the tutorial finished (or skipped). Idempotent. */
export function markOnboardingComplete(): void {
  saveOnboarding({ schemaVersion: 1, completed: true, step: 'done' });
}

/** Reset so the guided flow runs again on the next fresh game. */
export function requestOnboardingReplay(): void {
  saveOnboarding({ ...DEFAULT_RECORD });
}
