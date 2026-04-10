import type { DailyLogEntry } from '../engine/types';

interface BankruptcyScreenProps {
  daysPlayed: number;
  peakBalance: number;
  lastLog: DailyLogEntry | null;
  onRestart: () => void;
}

function getInsight(daysPlayed: number, peakBalance: number, lastLog: DailyLogEntry | null): string {
  if (lastLog && lastLog.pestDestroyedPlots.length > 0) {
    return 'Pests destroyed your final crops. Harvest early when pest risk is high.';
  }
  if (lastLog?.weatherId === 'flash_drought') {
    return 'A flash drought ended your run. Avoid planting during drought events.';
  }
  if (daysPlayed <= 5) {
    return 'Your run was very short. Try buying seeds before advancing the day.';
  }
  if (peakBalance < 50) {
    return 'Balance never recovered. Focus on fast Radishes early to build a buffer.';
  }
  return 'Try diversifying between fast Radishes and higher-yield Pumpkins.';
}

export function BankruptcyScreen({
  daysPlayed,
  peakBalance,
  lastLog,
  onRestart,
}: BankruptcyScreenProps) {
  const insight = getInsight(daysPlayed, peakBalance, lastLog);
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

      <div className="w-full max-w-xs px-4 py-3 bg-farm-ink/60 border border-farm-stone/30 rounded">
        <p className="font-pixel text-[11px] text-farm-stone/80 leading-relaxed text-center">
          💡 {insight}
        </p>
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
