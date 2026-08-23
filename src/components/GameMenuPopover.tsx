import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import { isMuted, setMuted } from '../audio/sfx';
import { isDoNotTrack, isOptedOut, optIn, optOut } from '../analytics/consent';
import { setAnalyticsOptOut } from '../analytics/track';

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

interface GameMenuPopoverProps {
  /** Attached to the menu container so the shell's outside-click test works. */
  popoverRef: RefObject<HTMLDivElement>;
  /** Selector matching any menu row, used to focus the first one on mount. */
  rowSelector: string;
  /** Abandons the live run and starts a fresh one. */
  onRestart: () => void;
  /** Flags the tutorial for replay and restarts the run. */
  onReplayTutorial: () => void;
  /** Closes the menu without moving focus (a modal or restart takes over). */
  dismiss: () => void;
  /** Opens the credits modal (owned by the shell so it outlives this popover). */
  onOpenCredits: () => void;
}

/**
 * 024 — the interaction-gated body of the game menu, code-split out of the entry
 * bundle by {@link GameMenu}. Holds the rows, toggles and the two-step
 * destructive actions; the gear trigger, dismissal and the credits modal live in
 * the shell (the modal must outlive this popover, which unmounts when the menu
 * closes).
 */
export function GameMenuPopover({
  popoverRef,
  rowSelector,
  onRestart,
  onReplayTutorial,
  dismiss,
  onOpenCredits,
}: GameMenuPopoverProps) {
  const [muted, setMutedState] = useState(() => isMuted());
  const [optedOut, setOptedOut] = useState(() => isOptedOut());
  // Each two-step row reports its arming here so it can be voiced from a live
  // region outside the menu (see ArmedRow). Kept per-row so one row's auto-
  // disarm never clears the other's announcement.
  const [restartAnnounce, setRestartAnnounce] = useState('');
  const [replayAnnounce, setReplayAnnounce] = useState('');
  // DNT hard-disables tracking regardless of the local flag; reflect that so the
  // row never implies analytics are live when track() will always no-op.
  const dntActive = isDoNotTrack();

  // Focus the first row on mount so the menu is usable from the keyboard. Lives
  // here (not in the shell) because the shell opens before this lazy chunk
  // mounts, so its ref is still null when an open-keyed effect would run.
  useEffect(() => {
    popoverRef.current?.querySelector<HTMLElement>(rowSelector)?.focus();
  }, [popoverRef, rowSelector]);

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

  return (
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
            dismiss();
            onRestart();
          }}
        />
        <ArmedRow
          label="Replay tutorial"
          armedLabel="Tap again to replay (restarts run)"
          armedAnnouncement="Replay tutorial armed. Activate again to confirm — this restarts your run."
          onArmedChange={setReplayAnnounce}
          onConfirm={() => {
            dismiss();
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
        <button type="button" role="menuitem" onClick={onOpenCredits} className={ROW_CLASS}>
          Credits
        </button>
      </div>
    </>
  );
}
