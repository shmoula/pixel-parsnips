import type { DailyLogEntry } from '../engine/types';
import { WEATHER_DEFINITIONS } from '../engine/constants';

interface DailyLogProps {
  log: DailyLogEntry;
}

const WEATHER_EMOJI: Record<string, string> = {
  drought: '☀️',
  overcast: '☁️',
  sunny: '🌤️',
  warm_breeze: '🍃',
  perfect_sun: '🌟',
};

export function DailyLog({ log }: DailyLogProps) {
  const weather = WEATHER_DEFINITIONS[log.weatherId];
  return (
    <section
      aria-label="Daily summary"
      className="flex flex-col gap-2 p-3 bg-farm-soil rounded-lg text-xs"
    >
      <h2 className="font-pixel text-xs text-farm-gold">Day {log.day} Summary</h2>

      {/* Weather badge */}
      <div className="flex items-center gap-1 px-2 py-1 rounded bg-farm-parchment/20">
        <span aria-hidden="true">{WEATHER_EMOJI[log.weatherId]}</span>
        <span className="font-pixel text-farm-parchment">{weather.name}</span>
        <span className="text-farm-stone ml-auto">×{(log.weatherMultiplier).toFixed(1)}</span>
      </div>

      {/* Harvest line-items */}
      {log.harvests.length > 0 && (
        <div className="flex flex-col gap-1">
          {log.harvests.map(h => (
            <div key={h.plotId} className="flex justify-between text-farm-stone">
              <span>Plot {h.plotId} {h.cropId}</span>
              <span className="text-farm-grass">+{h.adjustedYield}🪙</span>
            </div>
          ))}
        </div>
      )}

      <hr className="border-farm-stone/30" />

      {/* Accounting rows */}
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
    </section>
  );
}
