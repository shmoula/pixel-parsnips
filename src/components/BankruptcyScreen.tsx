import type { ReactNode } from 'react';
import { getSeasonForDay } from '../engine/seasons';
import { MedalBadge } from './MedalBadge';
import { Coin } from './Coin';
import { EmojiIcon } from './EmojiIcon';
import type { DailyLogEntry, RunDayRecord } from '../engine/types';
import { DEATH_TITLES, deriveEvidenceLine, deriveInsight, type DeathCauseId } from '../engine/runPostMortem';
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
  showEventsUnlockTease?: boolean;
  /** 025 — per-day record of the finished run; empty for pre-schema-11 saves. */
  runHistory: readonly RunDayRecord[];
  /** 025 — how this run died, derived by the caller via `deathCauseForState`. */
  deathCause: DeathCauseId;
}

function NewBestBadge() {
  return (
    <span
      aria-label="new personal best"
      className="ml-2 font-pixel text-caption text-farm-gold"
    >
      🏆 New Best!
    </span>
  );
}

interface StatRowProps {
  label: string;
  value: ReactNode;
  isNewBest: boolean;
}

function StatRow({ label, value, isNewBest }: StatRowProps) {
  return (
    <div className="flex justify-between items-center px-4 py-2 bg-farm-ink rounded">
      <span className="font-pixel text-body text-farm-parchment/70">
        {label}
        {isNewBest && <NewBestBadge />}
      </span>
      <span className="font-pixel text-title text-farm-gold">{value}</span>
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
  showEventsUnlockTease = false,
  runHistory,
  deathCause,
}: BankruptcyScreenProps) {
  const season = getSeasonForDay(daysPlayed);
  const evidence = deriveEvidenceLine(runHistory);
  const insight = evidence ?? deriveInsight(lastDailyLog, daysPlayed, peakBalance);
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

      <h1 className="font-pixel text-title text-farm-red text-center leading-relaxed">
        Bankrupt!
      </h1>

      {/* 025 — how this run died. The medal below says how far it got; these answer
          different questions, so both stay. */}
      <p className="font-pixel text-body text-farm-gold uppercase tracking-widest">
        {DEATH_TITLES[deathCause]}
      </p>

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
          value={<>{peakBalance}<Coin /></>}
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
        <span className="font-pixel text-caption text-farm-parchment/70 uppercase tracking-widest">
          Personal Records
        </span>
        {isFirstRun ? (
          <p className="font-pixel text-caption text-farm-parchment leading-relaxed">
            This was your first run — your records start now.
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-pixel text-caption text-farm-parchment">
          <span>Best days:</span><span className="text-right">{records.bestDaysSurvived}</span>
          <span>Best peak:</span><span className="text-right">{records.bestPeakBalance}<Coin /></span>
          <span>Best season:</span><span className="text-right">{records.bestSeasonReached || '—'}</span>
          <span>Most disasters:</span><span className="text-right">{records.mostDisastersSurvived}</span>
          <span>Best streak:</span><span className="text-right">{records.bestHarvestStreak}</span>
        </div>
      </section>

      <div className="flex flex-col gap-2 w-full max-w-xs px-4 py-3 bg-farm-ink rounded border border-farm-stone/30">
        <span className="font-pixel text-caption text-farm-parchment/70 uppercase tracking-widest">Insight</span>
        <p className="font-pixel text-body text-farm-parchment leading-relaxed">{insight}</p>
      </div>

      {showEventsUnlockTease && (
        <p className="font-pixel text-caption text-farm-gold leading-relaxed">
          <EmojiIcon>🧳</EmojiIcon> Word of your farm is spreading — from your next run, visitors will arrive with offers.
        </p>
      )}

      {/* 025 — the other end of the welcome modal's promise. A confirmation that
          this was the intended first experience, not a consolation. */}
      <p className="font-pixel text-body text-farm-gold">Told you. Again?</p>

      <div className="flex flex-col gap-2 w-full max-w-xs mt-2">
        <button
          type="button"
          aria-label="Restart game"
          onClick={onRestart}
          className="
            px-8 py-3 rounded-lg font-pixel text-body
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
            px-8 py-2 rounded-lg font-pixel text-caption
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
