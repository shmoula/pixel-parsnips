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
        flex flex-wrap items-center gap-2 px-4 py-2
        bg-[#0E0A04]/95 backdrop-blur-sm
        border-b border-[#5C3D1E]/50
      "
    >
      {/* Left: Day chip + Balance chip (with always-visible cost sub-label) */}
      <div className="flex items-center gap-2">

        {/* Day chip */}
        <div className="flex items-center gap-1.5 bg-[#261808] border border-[#5C3D1E]/60 px-2.5 py-1 rounded">
          <span className="text-base leading-none" aria-hidden="true">☀️</span>
          <div className="flex flex-col leading-none">
            <span className="font-pixel text-[10px] text-farm-stone/60 uppercase tracking-widest">Day</span>
            <span className="font-pixel text-[18px] text-farm-gold">{currentDay}</span>
          </div>
        </div>

        {/* Balance chip — cost sub-label always visible beneath the number */}
        <div className="flex items-center gap-1.5 bg-[#261808] border border-[#5C3D1E]/60 px-2.5 py-1 rounded">
          <span className="text-lg leading-none" aria-hidden="true">🪙</span>
          <div className="flex flex-col leading-none">
            <span className="font-pixel text-[18px] text-farm-gold">{coinBalance}</span>
            <span
              aria-label={`Land lease: ${LAND_LEASE_FEE} coins per day, tax: ${TAX_RATE * 100}%`}
              className="font-pixel text-[9px] text-farm-stone/50 whitespace-nowrap mt-0.5"
            >
              −{LAND_LEASE_FEE}🪙/day · {TAX_RATE * 100}% tax
            </span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 ml-auto">
        <button
          type="button"
          aria-label="View last turn summary"
          onClick={onLastTurn}
          disabled={!hasLastTurn}
          className="
            font-pixel text-[14px] px-2 py-1.5 rounded uppercase tracking-widest
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
            font-pixel text-[14px] px-4 py-1.5 rounded uppercase tracking-widest
            bg-farm-grass text-farm-parchment
            hover:bg-farm-gold hover:text-farm-ink
            active:enabled:scale-95 disabled:opacity-50 transition-all
          "
        >
          Next Day →
        </button>
      </div>

      {/* Shop toggle — mobile only; prominent primary-action styling */}
      <button
        type="button"
        aria-label="Open shop"
        onClick={onToggleShop}
        className="
          md:hidden
          font-pixel text-[14px] px-5 py-2 rounded uppercase tracking-widest
          bg-farm-gold text-farm-ink
          border-2 border-farm-gold/80
          ring-2 ring-farm-gold/25
          shadow-lg shadow-farm-gold/20
          hover:brightness-110 active:scale-95 transition-all
        "
      >
        🌾 Shop
      </button>
    </header>
  );
}
