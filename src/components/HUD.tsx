import { useState } from 'react';
import { TAX_RATE } from '../engine/constants';
import { getReputationTier } from '../engine/reputation';
import { getSeasonForDay, shortSeasonLabel, type SeasonConfig } from '../engine/seasons';
import { Coin } from './Coin';
import { EmojiIcon } from './EmojiIcon';
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
  return 'border-[#5C3D1E]/60';
}

function getSeasonMobileLabel(expanded: boolean, number: number, name: string, short: string): string {
  return expanded ? `Season ${number} · ${name}` : short;
}

function getRepTitleClass(expanded: boolean): string {
  return `font-pixel text-caption text-farm-parchment/90 whitespace-nowrap ${expanded ? 'inline' : 'hidden'} sm:inline`;
}

function getBalanceTextClass(danger: DangerLevel): string {
  // Lighter than farm-red so the "critical" balance keeps a ≥4.5:1 contrast
  // ratio against the dark #261808 chip (WCAG AA / Lighthouse a11y).
  if (danger === 'critical') return 'text-[#EB6A5C]';
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
  /** Current uncapped consecutive-harvest-day count; chip is hidden at 0. */
  harvestStreak: number;
  /** False when advancing only burns lease+tax (no seeds, nothing growing). Drives the warning label. */
  canAdvanceProductively: boolean;
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
}: HUDProps) {
  const season = getSeasonForDay(currentDay);
  const reputation = getReputationTier(currentDay);
  const dayIntoSeason = currentDay - season.startDay + 1;
  const targetMet = coinBalance >= season.target;
  const daysRemainingInSeason = season.endDay - currentDay + 1;
  const showWarning = currentDay >= season.startDay + 17 && !targetMet && currentDay <= season.endDay;
  const showLeasePreview = currentDay === season.endDay;
  const nextSeasonLease = showLeasePreview ? getNextSeasonLease(season, endlessMode) : null;

  const [seasonExpanded, setSeasonExpanded] = useState(false);
  const [repExpanded, setRepExpanded] = useState(false);
  const seasonLen = season.endDay - season.startDay + 1;
  const seasonShort = shortSeasonLabel(season.name);
  const seasonMobileLabel = getSeasonMobileLabel(seasonExpanded, season.number, season.name, seasonShort);
  const repTitleClass = getRepTitleClass(repExpanded);

  const dangerLevel = getDangerLevel(coinBalance, season.leasePerDay);
  const balanceBorderClass = getBalanceBorderClass(dangerLevel);
  const balanceTextClass = getBalanceTextClass(dangerLevel);

  return (
    <header
      aria-label="Game status"
      className="
        flex flex-wrap items-stretch gap-2 px-4 py-2
        bg-[#0E0A04]/95 backdrop-blur-sm
        border-b border-[#5C3D1E]/50
      "
    >
      {/* Left: Season chip + Day chip + Balance/target chip.
          `contents` keeps the chips in the header's own flex row at every width, so
          they wrap one at a time alongside the status/action group. A real flex box
          here would shrink and wrap internally, stranding a chip on its own line
          while the group beside it wrapped down to a third. */}
      <div className="contents">
        <button
          type="button"
          // No aria-label: the visible compact text ("Spring", "D1/20") is the
          // accessible name. A prose label here would not contain the visible
          // abbreviations and trips axe's label-content-name-mismatch (WCAG 2.5.3).
          aria-expanded={seasonExpanded}
          onClick={() => setSeasonExpanded(v => !v)}
          className="flex min-h-[44px] md:min-h-0 flex-col justify-center leading-tight px-2.5 py-1 bg-[#261808] border border-[#5C3D1E]/60 rounded text-left"
        >
          <span className="font-pixel text-title text-farm-gold">
            <span className="sm:hidden">D{dayIntoSeason}/{seasonLen}</span>
            <span className="hidden sm:inline">Day {dayIntoSeason} / {seasonLen}</span>
          </span>
          <span className="font-pixel text-caption text-farm-parchment/70 uppercase tracking-widest">
            <span className="sm:hidden">{seasonMobileLabel}</span>
            <span className="hidden sm:inline">Season {season.number} · {season.name}</span>
          </span>
        </button>
        <div data-onboarding="balance-chip" className={`flex items-center gap-1.5 bg-[#261808] px-2.5 py-1 rounded border ${balanceBorderClass}`}>
          <span className="text-lg leading-none" aria-hidden="true">🪙</span>
          <div className="flex flex-col justify-center leading-tight">
            <span
              className={`font-pixel text-title ${balanceTextClass}`}
              aria-label={`Coins: ${coinBalance}. Season goal: ${season.target} coins by day ${seasonLen} of the season.`}
            >
              {coinBalance}
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
        {harvestStreak > 0 && (
          <div
            aria-label={`Harvest streak: ${harvestStreak} days`}
            title={`Harvest streak: ${harvestStreak} day${harvestStreak === 1 ? '' : 's'} in a row. Next harvest earns +${Math.min(harvestStreak, 4) * 5}🪙 bonus (capped at +20).`}
            className="flex items-center gap-1 bg-[#261808] px-2.5 py-1 rounded border border-[#5C3D1E]/60 cursor-help"
          >
            <EmojiIcon className="text-base leading-none">🔥</EmojiIcon>
            <span className="font-pixel text-caption text-farm-gold">×{harvestStreak}</span>
          </div>
        )}
        <button
          type="button"
          aria-label={`Reputation: ${reputation.title}`}
          aria-expanded={repExpanded}
          title={`Reputation: ${reputation.title}. Your standing grows as you survive more days this run.`}
          onClick={() => setRepExpanded(v => !v)}
          className="flex min-h-[44px] md:min-h-0 items-center gap-1.5 bg-[#261808] px-2.5 py-1 rounded border border-[#5C3D1E]/60"
        >
          <span className="text-base leading-none -translate-y-[0.13em]" aria-hidden="true">🎖️</span>
          <span className={repTitleClass}>
            {reputation.title}
          </span>
        </button>
      </div>

      {/* Right: Lease/Tax (hidden on small screens) and the action buttons, kept in one
          flex item so a single `ml-auto` right-aligns them as a unit — sharing the
          header's first line, or on a line of their own once the chips push them down. */}
      <div className="flex items-center justify-end gap-2 sm:gap-3 ml-auto">
        <div className="hidden sm:flex items-center gap-3">
          <span className="font-pixel text-caption text-farm-stone/50 uppercase tracking-widest">
            Lease {season.leasePerDay}<Coin />/day
            {showLeasePreview && nextSeasonLease !== null && (
              <span className="ml-1 text-farm-gold/70">
                (rises to {nextSeasonLease} next season)
              </span>
            )}
          </span>
          <span className="font-pixel text-caption text-farm-stone/50 uppercase tracking-widest">
            Tax {TAX_RATE * 100}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="View last turn summary"
            onClick={onLastTurn}
            disabled={!hasLastTurn}
            className="
              font-pixel text-caption px-2 py-1.5 min-h-[44px] md:min-h-0 rounded uppercase tracking-widest
              bg-[#261808] text-farm-stone/60 border border-[#5C3D1E]/50
              hover:enabled:bg-[#3A2510] hover:enabled:text-farm-parchment/80 hover:enabled:border-[#5C3D1E]
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
        </div>
      </div>
    </header>
  );
}
