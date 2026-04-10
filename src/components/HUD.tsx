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
      {/* Left: Day chip + Balance chip */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-[#261808] border border-[#5C3D1E]/60 px-2.5 py-1 rounded">
          <span className="text-base leading-none" aria-hidden="true">☀️</span>
          <span className="font-pixel text-[10px] text-farm-stone/60 uppercase tracking-widest">Day</span>
          <span className="font-pixel text-sm text-farm-gold">{currentDay}</span>
        </div>
        <div className={[
          'flex items-center gap-1.5 bg-[#261808] px-2.5 py-1 rounded border',
          coinBalance <= LAND_LEASE_FEE
            ? 'border-farm-red/80 animate-pulse'
            : coinBalance <= LAND_LEASE_FEE * 3
            ? 'border-yellow-600/70'
            : 'border-[#5C3D1E]/60',
        ].join(' ')}>
          <span className="text-lg leading-none" aria-hidden="true">🪙</span>
          <span className={[
            'font-pixel text-sm',
            coinBalance <= LAND_LEASE_FEE
              ? 'text-farm-red'
              : coinBalance <= LAND_LEASE_FEE * 3
              ? 'text-yellow-300'
              : 'text-farm-gold',
          ].join(' ')}>{coinBalance}</span>
        </div>
      </div>

      {/* Centre-right: Lease + Tax — hidden on small screens to save space */}
      <div className="hidden sm:flex items-center gap-3 ml-auto">
        <span className="font-pixel text-[9px] text-farm-stone/50 uppercase tracking-widest">
          Lease {LAND_LEASE_FEE}🪙/day
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

      {/* Shop toggle — mobile only (T008) */}
      <button
        type="button"
        aria-label="Open shop"
        onClick={onToggleShop}
        className="
          md:hidden
          font-pixel text-[9px] px-3 py-1.5 rounded uppercase tracking-widest
          bg-farm-gold text-farm-ink
          hover:brightness-110 transition-all
        "
      >
        🌾 Shop
      </button>
    </header>
  );
}
