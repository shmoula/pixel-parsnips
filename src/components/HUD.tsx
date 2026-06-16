import { TAX_RATE } from '../engine/constants';
import { getReputationTier } from '../engine/reputation';
import { getSeasonForDay, type SeasonConfig } from '../engine/seasons';

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

function getBalanceTextClass(danger: DangerLevel, targetMet: boolean): string {
  // Lighter than farm-red so the "critical" balance keeps a ≥4.5:1 contrast
  // ratio against the dark #261808 chip (WCAG AA / Lighthouse a11y).
  if (danger === 'critical') return 'text-[#EB6A5C]';
  if (danger === 'low') return 'text-yellow-300';
  // Lighter than farm-grass so the "target met" balance keeps a ≥4.5:1
  // contrast ratio against the dark #261808 chip (WCAG AA / Lighthouse a11y).
  if (targetMet) return 'text-[#5FB54A]';
  return 'text-farm-gold';
}

interface HUDProps {
  currentDay: number;
  coinBalance: number;
  /** Mobile only: opens/closes the shop bottom sheet. */
  onToggleShop: () => void;
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
}

export function HUD({
  currentDay,
  coinBalance,
  onToggleShop,
  onNextDay,
  onLastTurn,
  isProcessing,
  hasLastTurn,
  endlessMode,
  harvestStreak,
}: HUDProps) {
  const season = getSeasonForDay(currentDay);
  const reputation = getReputationTier(currentDay);
  const dayIntoSeason = currentDay - season.startDay + 1;
  const targetMet = coinBalance >= season.target;
  const daysRemainingInSeason = season.endDay - currentDay + 1;
  const showWarning = currentDay >= season.startDay + 17 && !targetMet && currentDay <= season.endDay;
  const showLeasePreview = currentDay === season.endDay;
  const nextSeasonLease = showLeasePreview ? getNextSeasonLease(season, endlessMode) : null;

  const dangerLevel = getDangerLevel(coinBalance, season.leasePerDay);
  const balanceBorderClass = getBalanceBorderClass(dangerLevel);
  const balanceTextClass = getBalanceTextClass(dangerLevel, targetMet);

  return (
    <header
      aria-label="Game status"
      className="
        flex flex-wrap items-center gap-2 px-4 py-2
        bg-[#0E0A04]/95 backdrop-blur-sm
        border-b border-[#5C3D1E]/50
      "
    >
      {/* Left: Season chip + Day chip + Balance/target chip */}
      <div className="flex items-stretch gap-2">
        <div className="flex flex-col leading-tight px-2.5 py-1 bg-[#261808] border border-[#5C3D1E]/60 rounded">
          <span className="font-pixel text-[8px] text-farm-parchment/70 uppercase tracking-widest">
            Season {season.number} · {season.name}
          </span>
          <span className="font-pixel text-[10px] text-farm-gold">
            Day {dayIntoSeason} / {season.endDay - season.startDay + 1}
          </span>
        </div>
        <div className={`flex items-center gap-1.5 bg-[#261808] px-2.5 py-1 rounded border ${balanceBorderClass}`}>
          <span className="text-lg leading-none" aria-hidden="true">🪙</span>
          <span
            className={`font-pixel text-sm ${balanceTextClass}`}
            aria-label={`Coins: ${coinBalance}, season target: ${season.target}`}
          >
            {coinBalance} / {season.target} target
            {showWarning && (
              <span className="ml-1 text-farm-red">
                  — {daysRemainingInSeason} {daysRemainingInSeason === 1 ? 'day' : 'days'} left
                </span>
            )}
          </span>
        </div>
        {harvestStreak > 0 && (
          <div
            aria-label={`Harvest streak: ${harvestStreak} days`}
            title={`Harvest streak: ${harvestStreak} day${harvestStreak === 1 ? '' : 's'} in a row. Next harvest earns +${Math.min(harvestStreak, 4) * 5}🪙 bonus (capped at +20).`}
            className="flex items-center gap-1 bg-[#261808] px-2.5 py-1 rounded border border-[#5C3D1E]/60 cursor-help"
          >
            <span className="text-base leading-none" aria-hidden="true">🔥</span>
            <span className="font-pixel text-[10px] text-farm-gold">×{harvestStreak}</span>
          </div>
        )}
        <div
          aria-label={`Reputation: ${reputation.title}`}
          title={`Reputation: ${reputation.title}. Your standing grows as you survive more days this run.`}
          className="flex items-center gap-1.5 bg-[#261808] px-2.5 py-1 rounded border border-[#5C3D1E]/60 cursor-help"
        >
          <span className="text-base leading-none" aria-hidden="true">🎖️</span>
          <span className="font-pixel text-[10px] text-farm-parchment/90 whitespace-nowrap">
            {reputation.title}
          </span>
        </div>
      </div>

      {/* Centre-right: Lease + Tax — hidden on small screens */}
      <div className="hidden sm:flex items-center gap-3 ml-auto">
        <span className="font-pixel text-[9px] text-farm-stone/50 uppercase tracking-widest">
          Lease {season.leasePerDay}🪙/day
          {showLeasePreview && nextSeasonLease !== null && (
            <span className="ml-1 text-farm-gold/70">
              (rises to {nextSeasonLease} next season)
            </span>
          )}
        </span>
        <span className="font-pixel text-[9px] text-farm-stone/50 uppercase tracking-widest">
          Tax {TAX_RATE * 100}%
        </span>
      </div>

      {/* Action buttons: Last Turn + Next Day */}
      <div className="flex items-center gap-2 ml-auto sm:ml-0">
        <button
          type="button"
          aria-label="View last turn summary"
          onClick={onLastTurn}
          disabled={!hasLastTurn}
          className="
            font-pixel text-[9px] px-2 py-1.5 rounded uppercase tracking-widest
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
          aria-label="Advance to next day"
          onClick={onNextDay}
          disabled={isProcessing}
          className="
            font-pixel text-[10px] px-4 py-1.5 rounded uppercase tracking-widest
            bg-farm-grass text-farm-parchment
            hover:bg-farm-gold hover:text-farm-ink
            active:enabled:scale-95 disabled:opacity-50 transition-all
          "
        >
          Next Day →
        </button>
      </div>

      {/* Shop toggle — mobile only */}
      <button
        type="button"
        aria-label="Open shop"
        onClick={onToggleShop}
        className="
          md:hidden
          font-pixel text-[9px] px-4 py-2 rounded uppercase tracking-widest
          bg-farm-gold text-farm-ink ring-1 ring-farm-gold/50
          hover:brightness-110 transition-all
        "
      >
        🌾 Shop
      </button>
    </header>
  );
}
