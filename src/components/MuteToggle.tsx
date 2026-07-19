import { useState } from 'react';
import { isMuted, setMuted } from '../audio/sfx';

/** 021 — persistent SFX mute toggle, lives in the HUD's right button cluster. */
export function MuteToggle() {
  const [muted, setMutedState] = useState(() => isMuted());

  function toggle() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  }

  return (
    <button
      type="button"
      aria-pressed={muted}
      aria-label="Mute sound effects"
      title={muted ? 'Sound effects are off' : 'Sound effects are on'}
      onClick={toggle}
      className="
        font-pixel text-caption px-2 py-1.5 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 rounded
        bg-[#261808] text-farm-stone/60 border border-[#5C3D1E]/50
        hover:bg-[#3A2510] hover:text-farm-parchment/80 hover:border-[#5C3D1E]
        active:scale-95 transition-all
      "
    >
      <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span>
    </button>
  );
}
