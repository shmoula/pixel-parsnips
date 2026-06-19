import type { DailyLogEntry } from '../engine/types';
import { WEATHER_DEFINITIONS } from '../engine/constants';
import { announceText, activeText } from '../engine/market';

interface DailyLogProps {
  log: DailyLogEntry;
  /** When true, the weather badge renders without disaster (red) styling — used while
      the Day Summary reveal is still pending so the disaster is not spoiled early. */
  suppressDisasterStyling?: boolean;
}

const WEATHER_EMOJI: Record<string, string> = {
  drought: '☀️',
  overcast: '☁️',
  sunny: '🌤️',
  warm_breeze: '🍃',
  perfect_sun: '🌟',
  blight: '🍄',
  pest_infestation: '🐛',
  flash_drought: '☀️🔥',
};

export const DISASTER_WEATHER_IDS = new Set(['blight', 'pest_infestation', 'flash_drought']);

function LogAccountingRows({ log }: { log: DailyLogEntry }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-farm-stone">
        <span>Harvest</span>
        <span className={log.totalHarvestIncome > 0 ? 'text-farm-grass' : ''}>
          +{log.totalHarvestIncome}🪙
        </span>
      </div>

      {log.landLeaseDeducted > 0 && (
        <div className="flex justify-between text-farm-stone">
          <span>Land lease</span>
          <span className="text-farm-red">−{log.landLeaseDeducted}🪙</span>
        </div>
      )}

      {log.taxDeducted > 0 && (
        <div className="flex justify-between text-farm-stone">
          <span>Tax ({Math.round(log.taxRate * 100)}%)</span>
          <span className="text-farm-red">−{log.taxDeducted}🪙</span>
        </div>
      )}

      <div className="flex justify-between font-pixel text-farm-parchment border-t border-farm-stone/30 pt-1 mt-1">
        <span>Net</span>
        <span className={log.netChange >= 0 ? 'text-farm-grass' : 'text-farm-red'}>
          {log.netChange >= 0 ? '+' : ''}{log.netChange}🪙
        </span>
      </div>
    </div>
  );
}

function MarketLines({ log }: { log: DailyLogEntry }) {
  return (
    <>
      {/* Active market event */}
      {log.marketActive && (
        <div
          aria-label="Market event"
          className={
            log.marketActive.kind === 'shortage'
              ? 'flex items-center gap-1 px-2 py-1 rounded bg-farm-grass/20 border border-farm-grass/40 text-farm-parchment'
              : 'flex items-center gap-1 px-2 py-1 rounded bg-farm-red/20 border border-farm-red/40 text-farm-parchment'
          }
        >
          <span aria-hidden="true">📊</span>
          <span>{activeText(log.marketActive)}</span>
        </div>
      )}

      {/* Tomorrow's announced market event */}
      {log.marketAnnounced && (
        <div
          aria-label="Market forecast"
          className="flex items-center gap-1 px-2 py-1 rounded bg-farm-parchment/10 text-farm-stone"
        >
          <span aria-hidden="true">📈</span>
          <span>Tomorrow: {announceText(log.marketAnnounced)}</span>
        </div>
      )}
    </>
  );
}

export function DailyLog({ log, suppressDisasterStyling = false }: DailyLogProps) {
  const weather = WEATHER_DEFINITIONS[log.weatherId];
  return (
    <section
      aria-label="Daily summary"
      className="flex flex-col gap-2 p-3 bg-farm-soil rounded-lg text-xs"
    >
      <h2 className="font-pixel text-xs text-farm-gold">Day {log.day} Summary</h2>

      {/* Weather badge — disaster events get red/amber styling */}
      <div
        className={
          DISASTER_WEATHER_IDS.has(log.weatherId) && !suppressDisasterStyling
            ? 'flex items-center gap-1 px-2 py-1 rounded bg-farm-red/20 border border-farm-red/40'
            : 'flex items-center gap-1 px-2 py-1 rounded bg-farm-parchment/20'
        }
      >
        <span aria-hidden="true">{WEATHER_EMOJI[log.weatherId]}</span>
        <span className="font-pixel text-farm-parchment">{weather.name}</span>
        <span className="text-farm-stone ml-auto">×{(log.weatherMultiplier).toFixed(1)}</span>
      </div>

      <MarketLines log={log} />

      {/* Harvest line-items */}
      {log.harvests.length > 0 && (
        <div className="flex flex-col gap-1">
          {log.harvests.map(h => (
            <div key={h.plotId} className="flex justify-between text-farm-stone">
              <span>Plot {h.plotId + 1} {h.cropId}</span>
              <span className="text-farm-grass">+{h.adjustedYield}🪙</span>
            </div>
          ))}
        </div>
      )}

      {/* Exhaustion events */}
      {log.exhaustedPlots.length > 0 && (
        <div className="flex flex-col gap-1">
          {log.exhaustedPlots.map(plotId => (
            <div key={plotId} className="flex items-center gap-1 text-farm-stone">
              <span aria-hidden="true">🪨</span>
              <span>Plot #{plotId + 1} became exhausted.</span>
            </div>
          ))}
        </div>
      )}

      {/* Harvest streak bonus */}
      {log.streakBonus > 0 && (
        <div
          aria-label="Streak bonus"
          className="flex justify-between text-farm-gold"
        >
          <span>🔥 Streak bonus ×{Math.min(log.streakBefore, 4)}</span>
          <span className="text-farm-grass">+{log.streakBonus}🪙</span>
        </div>
      )}

      {/* Streak reset note — distinguishes season-end reset (harvested but new season cleared the streak)
          from miss-day reset (no harvest this turn). */}
      {log.streakBefore > 0 && log.streakAfter === 0 && (
        <div
          aria-label="Streak reset"
          className="flex items-center gap-1 text-farm-stone/70"
        >
          <span aria-hidden="true">🔥</span>
          <span>
            {log.harvests.length > 0
              ? 'New season reset the streak'
              : 'Streak reset'}
          </span>
        </div>
      )}

      <hr className="border-farm-stone/30" />

      {/* Accounting rows */}
      <LogAccountingRows log={log} />
    </section>
  );
}
