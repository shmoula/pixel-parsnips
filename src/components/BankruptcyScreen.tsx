import type { DailyLogEntry } from '../engine/types';

interface BankruptcyScreenProps {
  daysPlayed: number;
  peakBalance: number;
  lastDailyLog?: DailyLogEntry | null;
  onRestart: () => void;
}

function deriveInsight(
  log: DailyLogEntry | null | undefined,
  daysPlayed: number,
  peakBalance: number,
): string {
  if (!log) return 'Plant early and harvest often to build a coin reserve.';
  if (log.pestDestroyedPlots.length > 0)
    return 'Pests wiped your plots. Clear them quickly and replant to recover income.';
  if (log.weatherId === 'blight')
    return 'Blight destroyed your crops. Fast-growing radishes reduce blight exposure.';
  if (log.weatherId === 'flash_drought')
    return 'Flash Drought delayed your harvest. Keep a coin buffer to survive slow turns.';
  if (daysPlayed < 5)
    return 'You went bankrupt early. Start with radishes — they pay out in just 1 day.';
  if (peakBalance < 40)
    return 'Your balance stayed dangerously low. Aim for a buffer of 3× your lease cost.';
  return 'Keep a reserve above your daily lease cost to survive bad-weather turns.';
}

export function BankruptcyScreen({
  daysPlayed,
  peakBalance,
  lastDailyLog,
  onRestart,
}: BankruptcyScreenProps) {
  const insight = deriveInsight(lastDailyLog, daysPlayed, peakBalance);

  return (
    <div
      role="main"
      aria-label="Bankruptcy screen"
      className="
        flex flex-col items-center justify-center
        min-h-screen gap-6 p-8
        bg-farm-soil text-farm-parchment
      "
    >
      <div className="text-4xl">💸</div>

      <h1 className="font-pixel text-xl text-farm-red text-center leading-relaxed">
        Bankrupt!
      </h1>

      <p className="text-farm-stone font-pixel text-xs text-center leading-relaxed">
        You couldn&apos;t cover the land lease.
      </p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <div className="flex justify-between px-4 py-2 bg-farm-ink rounded">
          <span className="font-pixel text-xs text-farm-stone">Days Survived</span>
          <span className="font-pixel text-sm text-farm-gold">{daysPlayed}</span>
        </div>
        <div className="flex justify-between px-4 py-2 bg-farm-ink rounded">
          <span className="font-pixel text-xs text-farm-stone">Peak Balance</span>
          <span className="font-pixel text-sm text-farm-gold">{peakBalance}🪙</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 w-full max-w-xs px-4 py-3 bg-farm-ink rounded border border-farm-stone/30">
        <span className="font-pixel text-[9px] text-farm-stone uppercase tracking-widest">Insight</span>
        <p className="font-pixel text-xs text-farm-parchment leading-relaxed">{insight}</p>
      </div>

      <button
        type="button"
        aria-label="Restart game"
        onClick={onRestart}
        className="
          px-8 py-3 rounded-lg font-pixel text-sm
          bg-farm-grass text-farm-parchment
          hover:bg-farm-gold hover:text-farm-ink
          transition-colors mt-2
        "
      >
        Restart
      </button>
    </div>
  );
}
