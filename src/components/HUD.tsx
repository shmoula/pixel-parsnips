import { LAND_LEASE_FEE, TAX_RATE } from '../engine/constants';

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
}

export function HUD({
  currentDay,
  coinBalance,
  onToggleShop,
  onNextDay,
  onLastTurn,
  isProcessing,
  hasLastTurn,
}: HUDProps) {
  return (
    <header
      aria-label="Game status"
      className="
        flex flex-wrap items-center gap-2 px-4 py-3
        bg-farm-soil/80 backdrop-blur-sm text-farm-parchment
      "
    >
      {/* Left: Day chip + Balance chip */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <span className="text-xl" aria-hidden="true">☀️</span>
          <span className="text-lg font-pixel text-farm-gold">{currentDay}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-2xl leading-none" aria-hidden="true">🪙</span>
          <span className="text-xl font-pixel text-farm-gold">{coinBalance}</span>
        </div>
      </div>

      {/* Centre-right: Lease + Tax — hidden on small screens to save space */}
      <div className="hidden sm:flex items-center gap-3 ml-auto">
        <span className="text-xs text-farm-sky font-pixel">
          Lease {LAND_LEASE_FEE}🪙/day
        </span>
        <span className="text-xs text-farm-sky font-pixel">
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
            font-pixel text-xs px-2 py-1 rounded
            bg-farm-soil/60 text-farm-stone border border-farm-stone/40
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
            font-pixel text-xs px-4 py-2 rounded
            bg-farm-grass text-farm-parchment
            hover:bg-farm-gold hover:text-farm-ink
            disabled:opacity-50 transition-colors
          "
        >
          Next Day →
        </button>
      </div>

      {/* Shop toggle — mobile only (T008) */}
      <button
        type="button"
        aria-label="Open shop"
        onClick={onToggleShop}
        className="
          md:hidden
          font-pixel text-xs px-3 py-1 rounded
          bg-farm-gold text-farm-ink
          hover:brightness-110 transition-all
        "
      >
        🌾 Shop
      </button>
    </header>
  );
}
