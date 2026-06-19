import type { DailyLogEntry } from '../engine/types';
import { WEATHER_DEFINITIONS } from '../engine/constants';
import { DISASTER_WEATHER_IDS } from './DailyLog';

interface DisasterBannerProps {
  log: DailyLogEntry;
  /** When true, play the drop-in/pulse animations (gated by the modal + reduced-motion). */
  animate?: boolean;
}

const DISASTER_ICON: Record<string, string> = {
  blight: '🍄',
  pest_infestation: '🐛',
  flash_drought: '☀️🔥',
};

/** Heading text per disaster type (the body lines come from `bodyLines`). */
const DISASTER_TITLE: Record<string, string> = {
  blight: 'BLIGHT',
  pest_infestation: 'PEST INFESTATION',
  flash_drought: 'FLASH DROUGHT',
};

function bodyLines(log: DailyLogEntry): string[] {
  switch (log.weatherId) {
    case 'blight':
      return [WEATHER_DEFINITIONS.blight.description];
    case 'pest_infestation':
      return log.pestDestroyedPlots.map(id => `Plot #${id + 1} destroyed by pests.`);
    case 'flash_drought':
      return ['Crops planted in the next 2 days grow at half speed.'];
    default:
      return [];
  }
}

export function DisasterBanner({ log, animate = false }: DisasterBannerProps) {
  if (!DISASTER_WEATHER_IDS.has(log.weatherId)) return null;

  const icon = DISASTER_ICON[log.weatherId];
  const title = DISASTER_TITLE[log.weatherId];
  const lines = bodyLines(log);

  return (
    <div
      // The banner is inserted into the DOM after the staged reveal delay, so a screen
      // reader needs a live region to announce the disaster (the close button is auto-focused).
      role="alert"
      aria-live="assertive"
      aria-label="Disaster"
      className={[
        'flex items-center gap-3 mt-2 px-3 py-3 rounded-lg',
        'bg-farm-red/40 border-2 border-farm-red',
        'shadow-[0_0_12px_rgba(200,40,40,0.4)]',
        animate ? 'disaster-banner-anim' : '',
      ].filter(Boolean).join(' ')}
    >
      <span
        aria-hidden="true"
        className={['inline-block text-2xl leading-none', animate ? 'disaster-icon-anim' : ''].filter(Boolean).join(' ')}
      >
        {icon}
      </span>
      <div className="flex flex-col gap-0.5 text-xs text-farm-parchment">
        <span className="font-pixel tracking-widest text-farm-red">{title}</span>
        {lines.map((line, i) => (
          <span key={i}>{line}</span>
        ))}
      </div>
    </div>
  );
}
