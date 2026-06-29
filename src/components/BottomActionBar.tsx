interface BottomActionBarProps {
  onToggleShop: () => void;
  onNextDay: () => void;
  isProcessing: boolean;
  canAdvanceProductively: boolean;
  /** Suppress the bar entirely (e.g. while the mobile shop sheet covers the bottom edge). */
  hidden?: boolean;
}

function nextDayLabel(canAdvance: boolean): string {
  return canAdvance ? 'Advance to next day' : 'Plant seeds first — nothing planted yet';
}

function nextDayText(canAdvance: boolean): string {
  return canAdvance ? 'Next Day' : 'Plant seeds first';
}

/**
 * Mobile-only fixed action bar. Rendered as a sibling of the HUD (NOT inside it —
 * the HUD's backdrop-blur would trap position:fixed). Hidden at md and up, where
 * Next Day lives in the HUD and the shop is an always-visible sidebar.
 */
export function BottomActionBar({
  onToggleShop,
  onNextDay,
  isProcessing,
  canAdvanceProductively,
  hidden = false,
}: BottomActionBarProps) {
  if (hidden) return null;
  return (
    <div
      className="
        md:hidden fixed bottom-0 left-0 right-0 z-50
        flex items-stretch gap-2 px-3 pt-2
        bg-[#0E0A04]/95 backdrop-blur-sm border-t border-[#5C3D1E]/50
      "
      style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
    >
      <button
        type="button"
        data-onboarding="shop-button"
        aria-label="Open shop"
        onClick={onToggleShop}
        className="
          flex-1 min-h-[44px] font-pixel text-[10px] rounded uppercase tracking-widest
          bg-farm-gold text-farm-ink ring-1 ring-farm-gold/50
          hover:brightness-110 active:scale-95 transition-all
        "
      >
        🌾 Shop
      </button>
      <button
        type="button"
        data-onboarding="next-day"
        aria-label={nextDayLabel(canAdvanceProductively)}
        onClick={onNextDay}
        disabled={isProcessing}
        className="
          flex-[1.4] min-h-[44px] font-pixel text-[11px] rounded uppercase tracking-widest
          bg-farm-grass text-farm-parchment
          hover:bg-farm-gold hover:text-farm-ink
          active:enabled:scale-95 disabled:opacity-50 transition-all
        "
      >
        {nextDayText(canAdvanceProductively)} <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
