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
  blight: '🍄',
  pest_infestation: '🐛',
  flash_drought: '☀️🔥',
};

const DISASTER_WEATHER_IDS = new Set(['blight', 'pest_infestation', 'flash_drought']);

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

export function DailyLog({ log }: DailyLogProps) {
  const weather = WEATHER_DEFINITIONS[log.weatherId];
  const isDisaster = DISASTER_WEATHER_IDS.has(log.weatherId);
  return (
    <section
      aria-label="Daily summary"
      className="flex flex-col gap-2 p-3 bg-farm-soil rounded-lg text-xs"
    >
      <h2 className="font-pixel text-xs text-farm-gold">Day {log.day} Summary</h2>

      {/* Disaster headline — prominent alert above line items */}
      {isDisaster && (
        <p
          role="alert"
          className="font-pixel text-[14px] text-farm-red leading-snug"
        >
          ⚠️ {weather.name}!
        </p>
      )}

      {/* Weather badge — disaster events get red/amber styling */}
      <div
        className={
          DISASTER_WEATHER_IDS.has(log.weatherId)
            ? 'flex items-center gap-1 px-2 py-1 rounded bg-farm-red/20 border border-farm-red/40'
            : 'flex items-center gap-1 px-2 py-1 rounded bg-farm-parchment/20'
        }
      >
        <span aria-hidden="true">{WEATHER_EMOJI[log.weatherId]}</span>
        <span className="font-pixel text-farm-parchment">{weather.name}</span>
        <span className="text-farm-stone ml-auto">×{(log.weatherMultiplier).toFixed(1)}</span>
      </div>

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

      {/* Flash Drought announcement */}
      {log.weatherId === 'flash_drought' && (
        <div className="flex items-center gap-1 px-2 py-1 rounded bg-farm-red/20 border border-farm-red/40 text-farm-parchment font-pixel">
          <span aria-hidden="true">☀️🔥</span>
          <span>Flash Drought! Crops planted in the next 2 days grow at half speed.</span>
        </div>
      )}

      {/* Pest destroyed plots */}
      {log.pestDestroyedPlots.length > 0 && (
        <div className="flex flex-col gap-1">
          {log.pestDestroyedPlots.map(plotId => (
            <div key={plotId} className="flex items-center gap-1 text-farm-stone">
              <span aria-hidden="true">🐛</span>
              <span>Plot #{plotId + 1} destroyed by pests.</span>
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

      <hr className="border-farm-stone/30" />

      {/* Accounting rows */}
      <LogAccountingRows log={log} />
    </section>
  );
}
