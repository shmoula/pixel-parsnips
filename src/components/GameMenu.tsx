import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { track } from '../analytics/track';
import { EmojiIcon } from './EmojiIcon';

/** Any row, action or toggle — `menuitem` and `menuitemcheckbox` both match. */
const ANY_ROW = '[role^="menuitem"]';

/**
 * The menu body and the credits modal are code-split: neither renders until the
 * gear is clicked, so both stay off the initial critical-path JS payload the CI
 * bundle gate measures (and off first paint / TTI). Only the always-visible gear
 * below ships in the entry chunk — deferring the popover causes no first-paint
 * layout shift, unlike deferring the gear itself would. Null Suspense fallbacks
 * are fine: these are overlays, the chunks are small, and each resolves on the
 * interaction that mounts it.
 *
 * Credits state lives in this shell (not the popover) so the modal survives the
 * menu closing — opening credits dismisses the popover, which unmounts it.
 */
const GameMenuPopover = lazy(() =>
  import('./GameMenuPopover').then((m) => ({ default: m.GameMenuPopover })),
);

const CreditsModal = lazy(() =>
  import('./CreditsModal').then((m) => ({ default: m.CreditsModal })),
);

interface GameMenuProps {
  /** Abandons the live run and starts a fresh one. */
  onRestart: () => void;
  /** Flags the tutorial for replay and restarts the run. */
  onReplayTutorial: () => void;
}

/**
 * 024 — the game's only settings surface.
 *
 * Everything that is not gameplay lives here: sound, analytics consent, restart,
 * tutorial replay and asset credits. Rendered from the HUD only — the bankruptcy
 * and season-transition screens deliberately carry no chrome.
 *
 * This shell owns only the gear trigger, the open flag and dismissal (Escape /
 * outside click). The rows, toggles and credits modal live in the lazily loaded
 * {@link GameMenuPopover}.
 */
export function GameMenu({ onRestart, onReplayTutorial }: GameMenuProps) {
  const [open, setOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const gearRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    gearRef.current?.focus();
  }, []);

  const openCredits = useCallback(() => {
    track('credits_viewed', {});
    // Not close(): the modal takes focus on mount, so bouncing focus through the
    // gear first would be a visible detour. The modal returns it on close.
    setOpen(false);
    setCreditsOpen(true);
  }, []);

  // Escape and outside-click both dismiss. Bound to the document so they work
  // wherever focus currently sits — including inside the popover.
  // This also covers the "a game modal opened while the menu was up" case: every
  // path to a modal (Next Day, the action bar) begins with a click outside the
  // popover, which lands here first. No explicit force-close prop is needed, and
  // the modals' higher z-index covers the popover in any case.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target) || gearRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, close]);

  return (
    <div className="relative">
      <button
        ref={gearRef}
        type="button"
        aria-label="Game menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen(v => !v)}
        className="
          font-pixel text-caption px-2 py-1.5 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 rounded
          bg-farm-chip text-farm-stone/60 border border-farm-chipBorder/50
          hover:bg-farm-chipHover hover:text-farm-parchment/80 hover:border-farm-chipBorder
          active:scale-95 transition-all
        "
      >
        <EmojiIcon>⚙️</EmojiIcon>
      </button>

      {open && (
        <Suspense fallback={null}>
          <GameMenuPopover
            popoverRef={popoverRef}
            rowSelector={ANY_ROW}
            onRestart={onRestart}
            onReplayTutorial={onReplayTutorial}
            dismiss={() => setOpen(false)}
            onOpenCredits={openCredits}
          />
        </Suspense>
      )}

      {creditsOpen && (
        <Suspense fallback={null}>
          <CreditsModal
            onClose={() => {
              setCreditsOpen(false);
              gearRef.current?.focus();
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
