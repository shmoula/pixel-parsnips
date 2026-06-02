import { useEffect, useRef, type RefObject } from 'react';
import { getSeasonForDay } from '../engine/seasons';

export type SeasonTransitionVariant = 'passed' | 'failed' | 'victory';

interface SeasonTransitionModalProps {
  variant: SeasonTransitionVariant;
  /** The day the player just finished — last day of the just-completed season. */
  currentDay: number;
  coinBalance: number;
  peakBalance: number;
  /** Passed: advance to next season. Victory: flip endlessMode and advance. */
  onContinue: () => void;
  /** Victory only: end the run (reset to fresh state). */
  onEndRun: () => void;
  /** Failed only: reset to fresh state. */
  onRestart: () => void;
}

export function SeasonTransitionModal({
  variant,
  currentDay,
  coinBalance,
  peakBalance,
  onContinue,
  onEndRun,
  onRestart,
}: SeasonTransitionModalProps) {
  const justCompleted = getSeasonForDay(currentDay);
  const nextSeason = getSeasonForDay(currentDay + 1);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);

  const escapeHandler = variant === 'passed' ? onContinue : variant === 'failed' ? onRestart : onEndRun;

  useEffect(() => {
    primaryButtonRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') escapeHandler();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [escapeHandler]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Season ${justCompleted.number} ${variant}`}
      className="
        fixed inset-0 z-50 flex items-center justify-center p-4
        bg-black/70 backdrop-blur-sm
      "
    >
      <div className="
        max-w-md w-full bg-farm-soil border-2 border-farm-stone/50 rounded-lg
        p-6 flex flex-col gap-4 text-farm-parchment
      ">
        {variant === 'passed' && (
          <PassedVariant
            justCompleted={justCompleted}
            nextSeason={nextSeason}
            coinBalance={coinBalance}
            onContinue={onContinue}
            primaryButtonRef={primaryButtonRef}
          />
        )}
        {variant === 'failed' && (
          <FailedVariant
            justCompleted={justCompleted}
            coinBalance={coinBalance}
            peakBalance={peakBalance}
            currentDay={currentDay}
            onRestart={onRestart}
            primaryButtonRef={primaryButtonRef}
          />
        )}
        {variant === 'victory' && (
          <VictoryVariant
            justCompleted={justCompleted}
            coinBalance={coinBalance}
            peakBalance={peakBalance}
            currentDay={currentDay}
            onEndRun={onEndRun}
            onContinue={onContinue}
            primaryButtonRef={primaryButtonRef}
          />
        )}
      </div>
    </div>
  );
}

function PassedVariant({
  justCompleted,
  nextSeason,
  coinBalance,
  onContinue,
  primaryButtonRef,
}: {
  justCompleted: ReturnType<typeof getSeasonForDay>;
  nextSeason: ReturnType<typeof getSeasonForDay>;
  coinBalance: number;
  onContinue: () => void;
  primaryButtonRef: RefObject<HTMLButtonElement>;
}) {
  return (
    <>
      <h2 className="font-pixel text-lg text-farm-gold text-center">
        Season {justCompleted.number} — Complete
      </h2>
      <p className="font-pixel text-xs text-center leading-relaxed">
        {justCompleted.name} survived.
      </p>
      <div className="bg-farm-ink rounded p-3 font-pixel text-xs">
        Final balance: {coinBalance} / {justCompleted.target} target ✓
      </div>
      <div className="bg-farm-ink/50 rounded p-3 font-pixel text-[11px] flex flex-col gap-1">
        <div className="text-farm-stone/80">
          Next: {nextSeason.name} (Days {nextSeason.startDay}–{nextSeason.endDay})
        </div>
        <div>• Lease rises to {nextSeason.leasePerDay}/day</div>
        <div>• Disasters become more common ({Math.round(nextSeason.disasterTotalPct * 100)}%)</div>
        <div>• Target: {nextSeason.target} coins by Day {nextSeason.endDay}</div>
      </div>
      <button
        ref={primaryButtonRef}
        type="button"
        onClick={onContinue}
        className="
          mt-2 px-6 py-3 rounded font-pixel text-sm
          bg-farm-grass text-farm-parchment hover:bg-farm-gold hover:text-farm-ink
          transition-colors
        "
      >
        Begin Season {nextSeason.number}
      </button>
    </>
  );
}

function FailedVariant({
  justCompleted,
  coinBalance,
  peakBalance,
  currentDay,
  onRestart,
  primaryButtonRef,
}: {
  justCompleted: ReturnType<typeof getSeasonForDay>;
  coinBalance: number;
  peakBalance: number;
  currentDay: number;
  onRestart: () => void;
  primaryButtonRef: RefObject<HTMLButtonElement>;
}) {
  const gap = justCompleted.target - coinBalance;
  const gapPct = gap / justCompleted.target;
  const showCoinsShortHint = gapPct > 0 && gapPct <= 0.5;

  return (
    <>
      <h2 className="font-pixel text-lg text-farm-red text-center">Season Failed</h2>
      <p className="font-pixel text-xs text-center leading-relaxed">
        {justCompleted.name} target not met.
      </p>
      <div className="bg-farm-ink rounded p-3 font-pixel text-xs flex flex-col gap-2">
        <div>Final balance: {coinBalance} / {justCompleted.target} target</div>
        {showCoinsShortHint && <div className="text-farm-stone/80">You were {gap} coins short.</div>}
      </div>
      <div className="bg-farm-ink/50 rounded p-3 font-pixel text-[11px] flex flex-col gap-1">
        <div>• Days survived: {currentDay}</div>
        <div>• Seasons completed: {justCompleted.number - 1}</div>
        <div>• Peak balance: {peakBalance}</div>
      </div>
      <button
        ref={primaryButtonRef}
        type="button"
        onClick={onRestart}
        className="
          mt-2 px-6 py-3 rounded font-pixel text-sm
          bg-farm-grass text-farm-parchment hover:bg-farm-gold hover:text-farm-ink
          transition-colors
        "
      >
        Start New Run
      </button>
    </>
  );
}

function VictoryVariant({
  justCompleted,
  coinBalance,
  peakBalance,
  currentDay,
  onEndRun,
  onContinue,
  primaryButtonRef,
}: {
  justCompleted: ReturnType<typeof getSeasonForDay>;
  coinBalance: number;
  peakBalance: number;
  currentDay: number;
  onEndRun: () => void;
  onContinue: () => void;
  primaryButtonRef: RefObject<HTMLButtonElement>;
}) {
  return (
    <>
      <h2 className="font-pixel text-xl text-farm-gold text-center">🌾 VICTORY 🌾</h2>
      <p className="font-pixel text-xs text-center leading-relaxed">
        You survived a full year.
      </p>
      <div className="bg-farm-ink rounded p-3 font-pixel text-xs flex flex-col gap-1">
        <div>Final balance: {coinBalance} / {justCompleted.target} target ✓</div>
        <div>Total days: {currentDay}</div>
        <div>Peak balance: {peakBalance}</div>
      </div>
      <div className="bg-farm-ink/50 rounded p-3 font-pixel text-[11px] leading-relaxed">
        Want to keep going? Deep Winter never ends. Each new season raises lease and target.
      </div>
      <div className="flex gap-2 mt-2">
        <button
          ref={primaryButtonRef}
          type="button"
          onClick={onEndRun}
          className="
            flex-1 px-4 py-3 rounded font-pixel text-sm
            bg-[#261808] text-farm-parchment hover:bg-[#3A2510] border border-farm-stone/40
            transition-colors
          "
        >
          End Run Here
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="
            flex-1 px-4 py-3 rounded font-pixel text-sm
            bg-farm-grass text-farm-parchment hover:bg-farm-gold hover:text-farm-ink
            transition-colors
          "
        >
          Continue →
        </button>
      </div>
    </>
  );
}
