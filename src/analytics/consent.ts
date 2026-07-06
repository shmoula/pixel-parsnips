export const ANALYTICS_OPT_OUT_KEY = 'pixel-parsnips-analytics-optout';

/** True when the browser signals Do-Not-Track. */
export function isDoNotTrack(): boolean {
  if (typeof navigator === 'undefined') return false;
  const dnt = navigator.doNotTrack;
  return dnt === '1' || dnt === 'yes';
}

/** True when the player has explicitly opted out locally. */
export function isOptedOut(): boolean {
  try {
    return localStorage.getItem(ANALYTICS_OPT_OUT_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Single source of truth: track only when neither DNT nor local opt-out apply. */
export function isTrackingAllowed(): boolean {
  return !isDoNotTrack() && !isOptedOut();
}

export function optOut(): void {
  try {
    localStorage.setItem(ANALYTICS_OPT_OUT_KEY, 'true');
  } catch {
    /* storage unavailable; nothing to persist */
  }
}

export function optIn(): void {
  try {
    localStorage.removeItem(ANALYTICS_OPT_OUT_KEY);
  } catch {
    /* storage unavailable; nothing to persist */
  }
}
