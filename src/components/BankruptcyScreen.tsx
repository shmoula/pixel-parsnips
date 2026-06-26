import { getSeasonForDay } from '../engine/seasons';
import { MedalBadge } from './MedalBadge';
import type { DailyLogEntry } from '../engine/types';
import type { Medal } from '../engine/medals';
import type { PersonalBests } from '../engine/records';

interface BankruptcyScreenProps {
  daysPlayed: number;
  peakBalance: number;
  peakHarvestStreak: number;
  disastersSurvived: number;
  seasonReached: number;
  medal: Medal;
  records: PersonalBests;
  newBests: Set<keyof PersonalBests>;
  lastDailyLog?: DailyLogEntry | null;
  onRestart: () => void;
  onReplayTutorial: () => void;
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

function NewBestBadge() {
  return (
    <span
      aria-label="new personal best"
      className="ml-2 font-pixel text-[9px] text-farm-gold"
    >
      🏆 New Best!
    </span>
  );
}

interface StatRowProps {
  label: string;
  value: string;
  isNewBest: boolean;
}

function StatRow({ label, value, isNewBest }: StatRowProps) {
  return (
    <div className="flex justify-between items-center px-4 py-2 bg-farm-ink rounded">
      <span className="font-pixel text-xs text-farm-stone">
        {label}
        {isNewBest && <NewBestBadge />}
      </span>
      <span className="font-pixel text-sm text-farm-gold">{value}</span>
    </div>
  );
}

export function BankruptcyScreen({
  daysPlayed,
  peakBalance,
  peakHarvestStreak,
  disastersSurvived,
  seasonReached,
  medal,
  records,
  newBests,
  lastDailyLog,
  onRestart,
  onReplayTutorial,
}: BankruptcyScreenProps) {
  const season = getSeasonForDay(daysPlayed);
  const insight = deriveInsight(lastDailyLog, daysPlayed, peakBalance);
  const isFirstRun = records.totalRunsCompleted <= 1; // post-write: this run is run #1

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

      <MedalBadge medal={medal} />

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <StatRow
          label="Days Survived"
          value={String(daysPlayed)}
          isNewBest={newBests.has('bestDaysSurvived')}
        />
        <StatRow
          label="Season reached"
          value={`${seasonReached} (${season.name})`}
          isNewBest={newBests.has('bestSeasonReached')}
        />
        <StatRow
          label="Peak Balance"
          value={`${peakBalance}🪙`}
          isNewBest={newBests.has('bestPeakBalance')}
        />
        <StatRow
          label="Disasters Survived"
          value={String(disastersSurvived)}
          isNewBest={newBests.has('mostDisastersSurvived')}
        />
        <StatRow
          label="Longest streak"
          value={String(peakHarvestStreak)}
          isNewBest={newBests.has('bestHarvestStreak')}
        />
      </div>

      <section
        aria-label="Personal records across all runs"
        className="flex flex-col gap-2 w-full max-w-xs px-4 py-3 bg-farm-ink rounded border border-farm-stone/30"
      >
        <span className="font-pixel text-[9px] text-farm-stone uppercase tracking-widest">
          Personal Records
        </span>
        {isFirstRun ? (
          <p className="font-pixel text-[10px] text-farm-parchment leading-relaxed">
            This was your first run — your records start now.
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-pixel text-[10px] text-farm-parchment">
          <span>Best days:</span><span className="text-right">{records.bestDaysSurvived}</span>
          <span>Best peak:</span><span className="text-right">{records.bestPeakBalance}🪙</span>
          <span>Best season:</span><span className="text-right">{records.bestSeasonReached || '—'}</span>
          <span>Most disasters:</span><span className="text-right">{records.mostDisastersSurvived}</span>
          <span>Best streak:</span><span className="text-right">{records.bestHarvestStreak}</span>
        </div>
      </section>

      <div className="flex flex-col gap-2 w-full max-w-xs px-4 py-3 bg-farm-ink rounded border border-farm-stone/30">
        <span className="font-pixel text-[9px] text-farm-stone uppercase tracking-widest">Insight</span>
        <p className="font-pixel text-xs text-farm-parchment leading-relaxed">{insight}</p>
      </div>

      <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
        <button
          type="button"
          aria-label="Restart game"
          onClick={onRestart}
          className="
            px-8 py-3 rounded-lg font-pixel text-sm
            bg-farm-grass text-farm-parchment
            hover:bg-farm-gold hover:text-farm-ink
            transition-colors
          "
        >
          Restart
        </button>
        <button
          type="button"
          aria-label="Replay tutorial"
          onClick={onReplayTutorial}
          className="
            px-8 py-2 rounded-lg font-pixel text-[10px]
            bg-farm-ink text-farm-parchment border border-farm-stone/40
            hover:bg-farm-soil transition-colors
          "
        >
          Replay tutorial
        </button>
      </div>
    </div>
  );
}
