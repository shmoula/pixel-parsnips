import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { track } from '../analytics/track';

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
  /** 029 — reopens the previous turn's Day Summary. Below sm this menu is the
      only way to reach it; the HUD button is `hidden sm:inline-flex`. */
  onLastTurn: () => void;
  /** False when there is no previous turn to reopen; disables the row. */
  hasLastTurn: boolean;
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
export function GameMenu({ onRestart, onReplayTutorial, onLastTurn, hasLastTurn }: GameMenuProps) {
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
          inline-flex items-center justify-center
          min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 md:h-7 md:w-7 rounded
          bg-farm-chip border border-farm-chipBorder/50
          hover:bg-farm-chipHover hover:border-farm-chipBorder
          active:scale-95 transition-all
        "
      >
        {/* 029 — an inline SVG, not ⚙️. The emoji needed a hand-measured optical nudge,
            and that measurement is per-platform: tuned against Chromium's emoji font, it
            read off-centre in iOS Safari, where Apple Color Emoji has different vertical
            metrics. An SVG centres by geometry on every platform, so it needs no
            per-platform nudge. `currentColor` colours it from a Tailwind text-* utility
            instead of a brightness filter — here the fixed text-farm-parchment/90; the
            hover affordance is the button's bg/border, not the icon.
            Geometry verified at 44px and 4x in a browser; it breaks first at 16px. */}
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="h-[22px] w-[22px] text-farm-parchment/90"
        >
          <rect x="6.5" y="0" width="3" height="4" />
          <rect x="6.5" y="12" width="3" height="4" />
          <rect x="0" y="6.5" width="4" height="3" />
          <rect x="12" y="6.5" width="4" height="3" />
          <rect x="1.8" y="2.6" width="3" height="3" transform="rotate(45 3.3 4.1)" />
          <rect x="11.2" y="2.6" width="3" height="3" transform="rotate(45 12.7 4.1)" />
          <rect x="1.8" y="10.4" width="3" height="3" transform="rotate(45 3.3 11.9)" />
          <rect x="11.2" y="10.4" width="3" height="3" transform="rotate(45 12.7 11.9)" />
          <path fillRule="evenodd" d="M8 3a5 5 0 100 10A5 5 0 008 3zm0 3a2 2 0 110 4 2 2 0 010-4z" />
        </svg>
      </button>

      {open && (
        <Suspense fallback={null}>
          <GameMenuPopover
            popoverRef={popoverRef}
            rowSelector={ANY_ROW}
            onRestart={onRestart}
            onReplayTutorial={onReplayTutorial}
            onLastTurn={onLastTurn}
            hasLastTurn={hasLastTurn}
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
