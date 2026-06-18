import { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import type { DailyLogEntry } from '../engine/types';
import { DailyLog, DISASTER_WEATHER_IDS } from './DailyLog';
import { DisasterBanner } from './DisasterBanner';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface DaySummaryModalProps {
  log: DailyLogEntry;
  onClose: () => void;
  /** True on the auto-open after advancing a day (plays the staged reveal);
      false when reopened via "Last Turn" (show the resolved state at once). */
  animateReveal?: boolean;
}

const REVEAL_DELAY_MS = 700;

export function DaySummaryModal({ log, onClose, animateReveal = true }: DaySummaryModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();

  const isDisaster = DISASTER_WEATHER_IDS.has(log.weatherId);
  const isQuietDay = log.harvests.length === 0 && log.totalHarvestIncome === 0;

  // Stage the reveal only on a fresh disaster open with motion allowed.
  const shouldStage = isDisaster && animateReveal && !reducedMotion;
  const [revealed, setRevealed] = useState(!shouldStage);

  useEffect(() => {
    if (!shouldStage) return;
    const id = window.setTimeout(() => setRevealed(true), REVEAL_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [shouldStage]);

  useEffect(() => {
    closeButtonRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Disaster chrome (red bg + badge + banner) is shown once revealed.
  const showDisasterChrome = isDisaster && revealed;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className={[
          'rounded-2xl p-4 max-w-sm w-full mx-4 shadow-xl max-h-[80vh] flex flex-col',
          'transition-colors duration-500',
          showDisasterChrome ? 'bg-[#2A0A0A]' : 'bg-farm-soil',
        ].join(' ')}
        onClick={e => e.stopPropagation()}
      >
        <div className="overflow-y-auto overscroll-contain flex-1">
          {showDisasterChrome && (
            <div className="flex items-center gap-2 px-3 py-2 rounded bg-farm-red/20 border border-farm-red/50 mb-2">
              <span className="text-xl" aria-hidden="true">⚠️</span>
              <span className="font-pixel text-xs text-farm-red uppercase tracking-widest">Disaster!</span>
            </div>
          )}
          {isQuietDay && (
            <p className="font-pixel text-xs text-farm-stone text-center py-2 mb-1">
              Quiet day — no harvests.
            </p>
          )}

          <DailyLog log={log} suppressDisasterStyling={isDisaster && !revealed} />

          {showDisasterChrome && (
            <DisasterBanner log={log} animate={animateReveal && !reducedMotion} />
          )}
        </div>

        <button
          ref={closeButtonRef}
          type="button"
          aria-label="Close day summary"
          onClick={onClose}
          className="
            mt-4 w-full py-3 rounded-xl
            font-pixel text-sm
            bg-farm-grass text-farm-parchment
            hover:bg-farm-gold hover:text-farm-ink
            active:scale-95 transition-all
          "
        >
          Continue →
        </button>
      </div>
    </div>,
    document.body,
  );
}
