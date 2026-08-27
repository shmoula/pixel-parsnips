import { useState } from 'react';
import type { CropId } from '../engine/types';
import { getSeasonForDay, shortSeasonLabel, type SeasonConfig } from '../engine/seasons';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import { Coin } from './Coin';
import { EmojiIcon } from './EmojiIcon';
import { ExpandableChip } from './ExpandableChip';
import { GameMenu } from './GameMenu';
import { nextDayLabel, nextDayText } from './nextDayCopy';

/** Returns the next-season lease cost, or null if there is no next season to preview. */
function getNextSeasonLease(season: SeasonConfig, endlessMode: boolean): number | null {
  // No "next season" exists at Season 4 endDay unless endless mode is on
  if (season.number === 4 && !endlessMode) return null;
  // Look up the lease of the day after this season ends
  return getSeasonForDay(season.endDay + 1).leasePerDay;
}

type DangerLevel = 'critical' | 'low' | 'safe';

function getDangerLevel(coinBalance: number, leasePerDay: number): DangerLevel {
  if (coinBalance <= leasePerDay) return 'critical';
  if (coinBalance <= leasePerDay * 3) return 'low';
  return 'safe';
}

function getBalanceBorderClass(danger: DangerLevel): string {
  if (danger === 'critical') return 'border-farm-red/80 animate-pulse';
  if (danger === 'low') return 'border-yellow-600/70';
  return 'border-farm-chipBorder/60';
}

function getSeasonMobileLabel(expanded: boolean, number: number, name: string, short: string): string {
  return expanded ? `Season ${number} · ${name}` : short;
}

/** 022 — live delivery-contract progress, or null (chip hidden). */
export type ContractChipData = { done: number; total: number; cropId: CropId; daysLeft: number } | null;

/** 022 — compact HUD chip showing delivery-contract progress and days remaining. */
function ContractChip({ contract }: { contract: ContractChipData }) {
  if (contract === null) return null;
  return (
    <div
      aria-label={`Contract: ${contract.done} of ${contract.total} ${contract.cropId} delivered, ${contract.daysLeft} days left`}
      title={`Deliver ${contract.total} ${contract.cropId} harvests before the deadline for the reward.`}
      className="flex items-center gap-1 bg-farm-chip px-2.5 py-1 rounded border border-farm-chipBorder/60 cursor-help"
    >
      <EmojiIcon className="text-base leading-none">📜</EmojiIcon>
      <span className="font-pixel text-caption text-farm-gold">
        {contract.done}/{contract.total} · {contract.daysLeft}d
      </span>
    </div>
  );
}

/**
 * 027 — the per-day coin ledger: the lease you owe, and the bonus your next harvest
 * will pay. Both halves are coins-per-day (the streak bonus is applied once per day on
 * any harvest day — see `computeStreakUpdate` in gameEngine.ts, not per harvest), which
 * is what makes them one chip rather than two. Replaces the pre-027 standalone streak
 * chip and the desktop-only lease readout, which was invisible below 640px (F7).
 *
 * WIDTH BUDGET: the mobile form must stay ≤81px at 375px or the HUD wraps to a third
 * row. Measured: `−15·+15` is 81px, `−15🔥+15` is 83px and costs a row. That is why the
 * `sm:hidden` spans carry no emoji and no `tracking-widest`. See specs/027-hud-legibility.
 *
 * COLOUR: `farm-stone` is unusable here — it measures 3.751 on `farm-chip` and fails
 * WCAG AA. The cost uses `farm-parchment/70` (7.06) and the bonus `farm-gold` (9.61).
 */
function DailyLedgerChip({
  leasePerDay,
  harvestStreak,
  nextSeasonLease,
}: {
  leasePerDay: number;
  harvestStreak: number;
  /** Next season's lease, previewed on the season's last day (sm+ only); null otherwise. */
  nextSeasonLease: number | null;
}) {
  const streakBonus = Math.min(harvestStreak, 4) * 5;
  const hasStreak = harvestStreak > 0;
  const days = `${harvestStreak} day${harvestStreak === 1 ? '' : 's'}`;

  const description = hasStreak
    ? `Lease: ${leasePerDay} coins per day. Harvest streak: ${days} in a row — the next harvest earns +${streakBonus} coins (capped at +20).`
    : `Lease: ${leasePerDay} coins per day, charged every night.`;

  return (
    <div
      aria-label={description}
      title={description}
      className="flex items-center gap-1 bg-farm-chip px-2.5 py-1 rounded border border-farm-chipBorder/60 cursor-help"
    >
      <span className="font-pixel text-caption text-farm-parchment/70">
        {/* U+2212 MINUS SIGN, not a hyphen. */}
        <span className="sm:hidden">−{leasePerDay}{hasStreak ? '·' : '/day'}</span>
        <span className="hidden sm:inline uppercase tracking-widest">
          Lease {leasePerDay}<Coin />/day
          {nextSeasonLease !== null && (
            <span className="ml-1 text-farm-gold/70">
              (rises to {nextSeasonLease} next season)
            </span>
          )}
        </span>
      </span>
      {hasStreak && (
        <span className="font-pixel text-caption text-farm-gold">
          <span className="sm:hidden">+{streakBonus}</span>
          <span className="hidden sm:inline">· +{streakBonus}<Coin /></span>
        </span>
      )}
    </div>
  );
}

/** 021 — resolves the number the balance chip should animate toward: the held
    (pre-turn) value while a Day Summary is holding the reveal, or the
    committed `coinBalance` otherwise (including mid-tick, so the animation
    lands on the real value). */
function getDisplayBalanceTarget(coinBalance: number, heldBalance: number | null | undefined, tickBalance: boolean | undefined): number {
  const holding = heldBalance !== null && heldBalance !== undefined && !tickBalance;
  return holding ? heldBalance : coinBalance;
}

function getBalanceTextClass(danger: DangerLevel): string {
  // Lighter than farm-red so the "critical" balance keeps a ≥4.5:1 contrast
  // ratio against the dark farm-chip background (WCAG AA / Lighthouse a11y).
  if (danger === 'critical') return 'text-farm-danger';
  if (danger === 'low') return 'text-yellow-300';
  return 'text-farm-gold';
}

interface HUDProps {
  currentDay: number;
  coinBalance: number;
  /** Advance the game by one day. */
  onNextDay: () => void;
  /** Reopen the Day Summary modal from the previous turn. */
  onLastTurn: () => void;
  /** Disable Next Day while a turn is processing. */
  isProcessing: boolean;
  /** Whether there is a previous-turn log to reopen. */
  hasLastTurn: boolean;
  /** Used by T012 to decide whether Day 80 shows a lease preview. */
  endlessMode: boolean;
  /** Current uncapped consecutive-harvest-day count. Drives only the bonus half of
      DailyLedgerChip (the lease half renders unconditionally); the bonus half is
      hidden at 0. */
  harvestStreak: number;
  /** False when advancing only burns lease+tax (no seeds, nothing growing). Drives the warning label. */
  canAdvanceProductively: boolean;
  /** 021 — value shown instead of the committed balance while the Day Summary
      holds the harvest reveal; null/undefined = show the committed balance. */
  heldBalance?: number | null;
  /** 021 — when true, the displayed balance rapid-ticks from the held value to
      the committed balance (celebration coins are landing). */
  tickBalance?: boolean;
  /** 022 — live delivery-contract progress, or null (chip hidden). */
  contract: ContractChipData;
  /** 024 — abandons the live run from the game menu. */
  onRestart: () => void;
  /** 024 — flags the tutorial for replay and restarts, from the game menu. */
  onReplayTutorial: () => void;
}

export function HUD({
  currentDay,
  coinBalance,
  onNextDay,
  onLastTurn,
  isProcessing,
  hasLastTurn,
  endlessMode,
  harvestStreak,
  canAdvanceProductively,
  heldBalance,
  tickBalance,
  contract,
  onRestart,
  onReplayTutorial,
}: HUDProps) {
  const season = getSeasonForDay(currentDay);
  const dayIntoSeason = currentDay - season.startDay + 1;
  const targetMet = coinBalance >= season.target;
  const daysRemainingInSeason = season.endDay - currentDay + 1;
  const showWarning = currentDay >= season.startDay + 17 && !targetMet && currentDay <= season.endDay;
  const showLeasePreview = currentDay === season.endDay;
  const nextSeasonLease = showLeasePreview ? getNextSeasonLease(season, endlessMode) : null;

  const [seasonExpanded, setSeasonExpanded] = useState(false);
  const seasonLen = season.endDay - season.startDay + 1;
  const seasonShort = shortSeasonLabel(season.name);
  const seasonMobileLabel = getSeasonMobileLabel(seasonExpanded, season.number, season.name, seasonShort);

  const dangerLevel = getDangerLevel(coinBalance, season.leasePerDay);
  const balanceBorderClass = getBalanceBorderClass(dangerLevel);
  const balanceTextClass = getBalanceTextClass(dangerLevel);

  const displayTarget = getDisplayBalanceTarget(coinBalance, heldBalance, tickBalance);
  const displayedBalance = useAnimatedNumber(displayTarget, Boolean(tickBalance));

  return (
    <header
      aria-label="Game status"
      className="
        relative z-20
        flex flex-wrap items-stretch gap-2 px-4 py-2
        bg-farm-bar/95 backdrop-blur-sm
        border-b border-farm-chipBorder/50
      "
    >
      {/* Left: Season chip + Day chip + Balance/target chip.
          `contents` keeps the chips in the header's own flex row at every width, so
          they wrap one at a time alongside the status/action group. A real flex box
          here would shrink and wrap internally, stranding a chip on its own line
          while the group beside it wrapped down to a third. */}
      <div className="contents">
        <ExpandableChip
          expanded={seasonExpanded}
          onToggle={() => setSeasonExpanded(v => !v)}
          className="flex min-h-[44px] md:min-h-0 flex-col justify-center leading-tight px-2.5 py-1 bg-farm-chip border border-farm-chipBorder/60 rounded text-left"
        >
          <span className="font-pixel text-title text-farm-gold">
            <span className="sm:hidden">D{dayIntoSeason}/{seasonLen}</span>
            <span className="hidden sm:inline">Day {dayIntoSeason} / {seasonLen}</span>
          </span>
          <span className="font-pixel text-caption text-farm-parchment/70 uppercase tracking-widest">
            <span className="sm:hidden">{seasonMobileLabel}</span>
            <span className="hidden sm:inline">Season {season.number} · {season.name}</span>
          </span>
        </ExpandableChip>
        <div data-onboarding="balance-chip" data-coin-target className={`flex items-center gap-1.5 bg-farm-chip px-2.5 py-1 rounded border ${balanceBorderClass}`}>
          <span className="text-lg leading-none" aria-hidden="true">🪙</span>
          <div className="flex flex-col justify-center leading-tight">
            <span
              className={`font-pixel text-title ${balanceTextClass}`}
              aria-label={`Coins: ${coinBalance}. Season goal: ${season.target} coins by day ${seasonLen} of the season.`}
            >
              {displayedBalance}
            </span>
            <span className="font-pixel text-caption text-farm-parchment/70 uppercase tracking-widest">
              <span className="sm:hidden">Goal {season.target}·D{seasonLen}</span>
              <span className="hidden sm:inline">Goal {season.target} by day {seasonLen}</span>
              {showWarning && (
                <span className="text-farm-red">
                  {' '}— {daysRemainingInSeason} {daysRemainingInSeason === 1 ? 'day' : 'days'} left
                </span>
              )}
            </span>
          </div>
        </div>
        <DailyLedgerChip
          leasePerDay={season.leasePerDay}
          harvestStreak={harvestStreak}
          nextSeasonLease={nextSeasonLease}
        />
        <ContractChip contract={contract} />
      </div>

      {/* Right: the action buttons (Last Turn, Next Day, game menu), kept in one flex
          item so a single `ml-auto` right-aligns them as a unit — sharing the header's
          first line, or on a line of their own once the chips push them down. The lease
          readout that used to live here moved into DailyLedgerChip, on the left. */}
      <div className="flex items-center justify-end gap-2 sm:gap-3 ml-auto">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="View last turn summary"
            onClick={onLastTurn}
            disabled={!hasLastTurn}
            className="
              font-pixel text-caption px-2 py-1.5 min-h-[44px] md:min-h-0 rounded uppercase tracking-widest
              bg-farm-chip text-farm-stone/60 border border-farm-chipBorder/50
              hover:enabled:bg-farm-chipHover hover:enabled:text-farm-parchment/80 hover:enabled:border-farm-chipBorder
              active:enabled:scale-95 transition-all
              disabled:opacity-30
            "
          >
            Last Turn
          </button>
          <button
            type="button"
            data-onboarding="next-day"
            aria-label={nextDayLabel(canAdvanceProductively)}
            onClick={onNextDay}
            disabled={isProcessing}
            className="
              hidden md:inline-flex
              font-pixel text-caption px-4 py-1.5 rounded uppercase tracking-widest
              bg-farm-grass text-farm-parchment
              hover:bg-farm-gold hover:text-farm-ink
              active:enabled:scale-95 disabled:opacity-50 transition-all
            "
          >
            {/* Press Start 2P's → glyph is parked low in the em box; lift it 0.2em
                (measured) onto the letters' optical centre. */}
            {nextDayText(canAdvanceProductively)} <span aria-hidden="true" className="inline-block -translate-y-[0.2em]">→</span>
          </button>
          <GameMenu onRestart={onRestart} onReplayTutorial={onReplayTutorial} />
        </div>
      </div>
    </header>
  );
}
