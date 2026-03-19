import { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import type { DailyLogEntry } from '../engine/types';
import { DailyLog } from './DailyLog';

interface DaySummaryModalProps {
  log: DailyLogEntry;
  onClose: () => void;
}

export function DaySummaryModal({ log, onClose }: DaySummaryModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Auto-focus close button so keyboard users can dismiss immediately
    closeButtonRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const isQuietDay = log.harvests.length === 0 && log.totalHarvestIncome === 0;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="
          bg-farm-soil rounded-2xl p-4
          max-w-sm w-full mx-4 shadow-xl
          max-h-[80vh] flex flex-col
        "
        onClick={e => e.stopPropagation()}
      >
        <div className="overflow-y-auto overscroll-contain flex-1">
          {isQuietDay && (
            <p className="font-pixel text-xs text-farm-stone text-center py-2 mb-1">
              Quiet day — no harvests.
            </p>
          )}

          <DailyLog log={log} />
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
