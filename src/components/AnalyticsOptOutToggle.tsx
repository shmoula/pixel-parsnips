import { useState } from 'react';
import { isOptedOut, optIn, optOut } from '../analytics/consent';
import { setAnalyticsOptOut } from '../analytics/track';

/** Small privacy control: flips the local analytics opt-out flag. */
export function AnalyticsOptOutToggle() {
  const [optedOut, setOptedOut] = useState<boolean>(() => isOptedOut());

  const toggle = () => {
    const next = !optedOut;
    if (next) optOut();
    else optIn();
    setAnalyticsOptOut(next);
    setOptedOut(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={!optedOut}
      className="fixed bottom-2 left-2 z-40 rounded bg-black/80 px-2 py-1 text-xs text-white hover:bg-black"
      title="Toggle anonymous analytics. No personal data is ever collected."
    >
      Analytics: {optedOut ? 'off' : 'on'}
    </button>
  );
}
