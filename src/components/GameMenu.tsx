import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { isMuted, setMuted } from '../audio/sfx';
import { isDoNotTrack, isOptedOut, optIn, optOut } from '../analytics/consent';
import { setAnalyticsOptOut, track } from '../analytics/track';
import { EmojiIcon } from './EmojiIcon';
import { CreditsModal } from './CreditsModal';

/** Any row, action or toggle — `menuitem` and `menuitemcheckbox` both match. */
const ANY_ROW = '[role^="menuitem"]';

const ROW_CLASS = `
  w-full text-left font-pixel text-caption px-3 py-2.5 min-h-[44px] rounded
  text-farm-parchment/90
  hover:bg-[#3A2510] focus-visible:bg-[#3A2510]
  disabled:opacity-60 disabled:hover:bg-transparent
`;

/** How long a two-step row stays armed before disarming itself. */
const ARM_TIMEOUT_MS = 5000;

interface ToggleRowProps {
  label: string;
  /** True when the feature is ON (not when it is disabled). */
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
  /** Extra explanation rendered under the label, in the accessible tree. */
  note?: ReactNode;
}

function ToggleRow({ label, on, onToggle, disabled = false, note }: ToggleRowProps) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={on}
      disabled={disabled}
      onClick={onToggle}
      className={ROW_CLASS}
    >
      <span className="flex items-center justify-between gap-3">
        <span>{label}</span>
        <span className="text-farm-gold uppercase tracking-widest">{on ? 'on' : 'off'}</span>
      </span>
      {note && <span className="block mt-1 text-farm-stone leading-relaxed">{note}</span>}
    </button>
  );
}

interface ArmedRowProps {
  label: string;
  /** Shown after the first activation, in place of `label`. */
  armedLabel: string;
  /**
   * Read aloud when the row arms. The visible label swaps silently on an
   * already-focused control, so assistive tech would otherwise hear nothing.
   * Reported up via `onArmedChange` because the live region that voices it must
   * live outside the `role="menu"`, whose only allowed children are menu items.
   */
  armedAnnouncement: string;
  /** Called with the announcement when armed, and `''` when it disarms. */
  onArmedChange: (announcement: string) => void;
  onConfirm: () => void;
}

/**
 * A row that destroys the live run, so it takes two activations. Auto-disarms
 * after ARM_TIMEOUT_MS so a much-later tap cannot confirm without a fresh first
 * tap. Mirrors the UnwinnableBanner pattern in GameBoard.
 */
function ArmedRow({ label, armedLabel, armedAnnouncement, onArmedChange, onConfirm }: ArmedRowProps) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    onArmedChange(armed ? armedAnnouncement : '');
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), ARM_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [armed, armedAnnouncement, onArmedChange]);

  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      className={`${ROW_CLASS} ${armed ? 'text-farm-red' : ''}`}
    >
      {armed ? armedLabel : label}
    </button>
  );
}

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
 */
export function GameMenu({ onRestart, onReplayTutorial }: GameMenuProps) {
  const [open, setOpen] = useState(false);
  const [muted, setMutedState] = useState(() => isMuted());
  const [optedOut, setOptedOut] = useState(() => isOptedOut());
  const [creditsOpen, setCreditsOpen] = useState(false);
  // Each two-step row reports its arming here so it can be voiced from a live
  // region outside the menu (see ArmedRow). Kept per-row so one row's auto-
  // disarm never clears the other's announcement.
  const [restartAnnounce, setRestartAnnounce] = useState('');
  const [replayAnnounce, setReplayAnnounce] = useState('');
  // DNT hard-disables tracking regardless of the local flag; reflect that so the
  // row never implies analytics are live when track() will always no-op.
  const dntActive = isDoNotTrack();
  const gearRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    gearRef.current?.focus();
  }, []);

  // Focus the first row on open so the menu is usable from the keyboard.
  useEffect(() => {
    if (!open) return;
    popoverRef.current?.querySelector<HTMLElement>(ANY_ROW)?.focus();
  }, [open]);

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

  function toggleSound() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  }

  function toggleAnalytics() {
    if (dntActive) return;
    const next = !optedOut;
    if (next) optOut();
    else optIn();
    setAnalyticsOptOut(next);
    setOptedOut(next);
  }

  function openCredits() {
    track('credits_viewed', {});
    // Not close(): the modal takes focus on mount, so bouncing focus through the
    // gear first would be a visible detour. The modal returns it on close.
    setOpen(false);
    setCreditsOpen(true);
  }

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
          bg-[#261808] text-farm-stone/60 border border-[#5C3D1E]/50
          hover:bg-[#3A2510] hover:text-farm-parchment/80 hover:border-[#5C3D1E]
          active:scale-95 transition-all
        "
      >
        <EmojiIcon>⚙️</EmojiIcon>
      </button>

      {open && (
        <>
        {/* Outside role="menu" (whose only allowed children are menu items) and
            kept mounted so a change from '' to text registers as a live update. */}
        <span className="sr-only" aria-live="assertive">{restartAnnounce}</span>
        <span className="sr-only" aria-live="assertive">{replayAnnounce}</span>
        <div
          ref={popoverRef}
          role="menu"
          aria-label="Game menu"
          className="
            absolute right-0 top-full mt-1 z-50 w-60
            flex flex-col gap-0.5 p-1
            bg-farm-soil border border-[#5C3D1E] rounded-lg
          "
        >
          <ArmedRow
            label="Restart run"
            armedLabel="Tap again to restart"
            armedAnnouncement="Restart run armed. Activate again to confirm."
            onArmedChange={setRestartAnnounce}
            onConfirm={() => {
              setOpen(false);
              onRestart();
            }}
          />
          <ArmedRow
            label="Replay tutorial"
            armedLabel="Tap again to replay (restarts run)"
            armedAnnouncement="Replay tutorial armed. Activate again to confirm — this restarts your run."
            onArmedChange={setReplayAnnounce}
            onConfirm={() => {
              setOpen(false);
              onReplayTutorial();
            }}
          />
          <ToggleRow label="Sound" on={!muted} onToggle={toggleSound} />
          <ToggleRow
            label="Anonymous analytics"
            on={!optedOut && !dntActive}
            onToggle={toggleAnalytics}
            disabled={dntActive}
            note={dntActive ? "Your browser's Do Not Track setting is on." : undefined}
          />
          <button type="button" role="menuitem" onClick={openCredits} className={ROW_CLASS}>
            Credits
          </button>
        </div>
        </>
      )}

      {creditsOpen && (
        <CreditsModal
          onClose={() => {
            setCreditsOpen(false);
            gearRef.current?.focus();
          }}
        />
      )}
    </div>
  );
}
