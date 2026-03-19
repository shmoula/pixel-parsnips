import { LAND_LEASE_FEE, TAX_RATE } from '../engine/constants';

interface HUDProps {
  currentDay: number;
  coinBalance: number;
  /** Mobile only: opens/closes the shop bottom sheet. */
  onToggleShop: () => void;
}

export function HUD({ currentDay, coinBalance, onToggleShop }: HUDProps) {
  return (
    <header
      aria-label="Game status"
      className="
        flex flex-wrap items-center gap-4 px-4 py-3
        bg-farm-soil text-farm-parchment rounded-lg
      "
    >
      <div className="flex items-center gap-1">
        <span className="text-sm text-farm-stone font-pixel">Day</span>
        <span className="text-lg font-pixel text-farm-gold">{currentDay}</span>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-sm text-farm-stone font-pixel">Balance</span>
        <span className="text-lg font-pixel text-farm-gold">
          {coinBalance}🪙
        </span>
      </div>

      <div className="flex items-center gap-1 ml-auto">
        <span className="text-xs text-farm-sky font-pixel">
          Lease {LAND_LEASE_FEE}🪙/day
        </span>
        <span className="text-xs text-farm-sky font-pixel ml-3">
          Tax {TAX_RATE * 100}%
        </span>
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
