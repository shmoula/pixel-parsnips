import { useState } from 'react';
import { isDoNotTrack, isOptedOut, optIn, optOut } from '../analytics/consent';
import { setAnalyticsOptOut } from '../analytics/track';

/** Small privacy control: flips the local analytics opt-out flag. */
export function AnalyticsOptOutToggle() {
  const [optedOut, setOptedOut] = useState<boolean>(() => isOptedOut());
  // DNT hard-disables tracking regardless of the local flag; reflect that so the
  // control never implies analytics are live when track() will always no-op.
  const dntActive = isDoNotTrack();

  const toggle = () => {
    if (dntActive) return;
    const next = !optedOut;
    if (next) optOut();
    else optIn();
    setAnalyticsOptOut(next);
    setOptedOut(next);
  };

  const on = !optedOut && !dntActive;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      disabled={dntActive}
      // bottom-20 on mobile keeps the control clear of the fixed bottom action
      // bar (its wide pixel-font label would otherwise obscure the SHOP button
      // and fail the touch target-size check); md+ hides that bar, so drop back
      // to bottom-2.
      className="fixed bottom-20 left-2 z-40 rounded bg-black/80 px-2 py-1 text-xs text-white hover:bg-black disabled:cursor-not-allowed md:bottom-2"
      title={dntActive ? 'Disabled by your browser Do Not Track setting.' : 'Toggle anonymous analytics. No personal data is ever collected.'}
    >
      Analytics: {on ? 'on' : 'off'}
    </button>
  );
}
