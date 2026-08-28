import { useState } from 'react';
import type { CropId } from '../engine/types';
import { getSeasonForDay, shortSeasonLabel, type SeasonConfig } from '../engine/seasons';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import { useReducedMotion } from '../hooks/useReducedMotion';
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

/** Coins the next harvest earns at this streak length; the engine caps the multiplier
 *  at 4 (`computeStreakUpdate` in gameEngine.ts, STREAK_BONUS_* in constants.ts). */
function getStreakBonus(harvestStreak: number): number {
  return Math.min(harvestStreak, 4) * 5;
}

/**
 * The harvest streak, as a lit flame on the day counter it accrues against.
 *
 * A streak is a state you either have or have lost, so it reads better as one glyph
 * than as a figure to parse: the pulse carries "this is live, don't break it" without
 * spending HUD width on digits that change daily. The count and the coins it earns are
 * one hover away rather than always on screen — the ledger chip beside it stays a
 * single per-day figure instead of two.
 *
 * The flame is the accessible element (`role="img"` + label), not the decorative emoji
 * inside it, so the streak is announced rather than skipped.
 */
function StreakFlame({ harvestStreak }: { harvestStreak: number }) {
  const reducedMotion = useReducedMotion();
  if (harvestStreak <= 0) return null;

  const days = `${harvestStreak} day${harvestStreak === 1 ? '' : 's'}`;
  const description = `Harvest streak: ${days} in a row — the next harvest earns +${getStreakBonus(harvestStreak)} coins (capped at +20).`;

  return (
    <span
      role="img"
      aria-label={description}
      title={description}
      // The pulse is the whole point of the glyph, so it is gated on the motion
      // preference rather than left running for players who asked for stillness.
      // `streak-flame` (index.css) breathes in scale as well as opacity; the class is
      // itself inside a prefers-reduced-motion query, so this gate is belt and braces.
      className={`inline-flex cursor-help ${reducedMotion ? '' : 'streak-flame-anim'}`}
    >
      {/* EmojiIcon carries the optical-centre lift: an emoji laid out beside Press
          Start 2P sits ~0.1875em low, because the pixel font paints entirely above
          the baseline while the emoji straddles it. `items-center` on the row lines
          the boxes up; only this lifts the ink to match. */}
      <EmojiIcon className="text-base leading-none">🔥</EmojiIcon>
    </span>
  );
}

/**
 * The per-day coin ledger: the lease you owe, every night.
 *
 * Introduced in 027 to surface the lease below 640px (F7) — it lived in a desktop-only
 * `hidden sm:flex` wrapper before, so mobile players could not see the per-day cost
 * before advancing. It briefly also carried the harvest-streak bonus; that moved to
 * `StreakFlame` on the day chip, leaving this chip one figure to read.
 *
 * WIDTH BUDGET: at 375px the header has 343px for its first row, and `StreakFlame` on
 * the day chip costs 19px of it (94px → 113px). That is paid for here: the mobile lease
 * reads `−15/d` (61px), not `−15/day` (77px). Measured — shrinking the flame instead does
 * not work (even a 10px glyph still wraps to a third row), so the suffix is the lever.
 * Keep this span emoji-free and free of `tracking-widest`. See specs/027-hud-legibility.
 *
 * COLOUR: `farm-stone` is unusable here — it measures 3.751 on `farm-chip` and fails
 * WCAG AA. The cost uses `farm-parchment/70` (7.06) and the preview `farm-gold/70` (5.47).
 */
function DailyLedgerChip({
  leasePerDay,
  nextSeasonLease,
}: {
  leasePerDay: number;
  /** Next season's lease, previewed on the season's last day (sm+ only); null otherwise. */
  nextSeasonLease: number | null;
}) {
  // The sm+ form previews next season's lease on the season's last day; the accessible
  // description (aria-label + title) mirrors it so screen-reader and hover users get the
  // same warning, degrading to the lease alone when there is no preview to show.
  const description =
    nextSeasonLease !== null
      ? `Lease: ${leasePerDay} coins per day, charged every night. Rises to ${nextSeasonLease} next season.`
      : `Lease: ${leasePerDay} coins per day, charged every night.`;

  return (
    <div
      aria-label={description}
      title={description}
      className="flex items-center gap-1 bg-farm-chip px-2.5 py-1 rounded border border-farm-chipBorder/60 cursor-help"
    >
      <span className="font-pixel text-caption text-farm-parchment/70">
        {/* U+2212 MINUS SIGN, not a hyphen. */}
        <span className="sm:hidden">−{leasePerDay}/d</span>
        <span className="hidden sm:inline uppercase tracking-widest">
          Lease {leasePerDay}<Coin />/day
          {nextSeasonLease !== null && (
            <span className="ml-1 text-farm-gold/70">
              (rises to {nextSeasonLease} next season)
            </span>
          )}
        </span>
      </span>
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
          <span className="flex items-center gap-1.5">
            <span className="font-pixel text-title text-farm-gold">
              <span className="sm:hidden">D{dayIntoSeason}/{seasonLen}</span>
              <span className="hidden sm:inline">Day {dayIntoSeason} / {seasonLen}</span>
            </span>
            <StreakFlame harvestStreak={harvestStreak} />
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
            {/* The button is inline-flex, so the literal space before the arrow
                collapses; `ml-1.5` gives the reliable gap instead. Press Start 2P's
                → glyph is parked low in the em box, so lift it 0.2em (measured) onto
                the letters' optical centre. */}
            {nextDayText(canAdvanceProductively)} <span aria-hidden="true" className="inline-block ml-1.5 -translate-y-[0.2em]">→</span>
          </button>
          <GameMenu onRestart={onRestart} onReplayTutorial={onReplayTutorial} />
        </div>
      </div>
    </header>
  );
}
