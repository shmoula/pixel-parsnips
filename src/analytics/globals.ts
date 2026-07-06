export const ANALYTICS_ID_KEY = 'pixel-parsnips-analytics-id';
const GAME_SAVE_KEY = 'pixel-parsnips-state';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export interface Utms {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

export interface GlobalProps extends Utms {
  session_id: string;
  anonymous_player_id: string;
  device_type: DeviceType;
}

function uuid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  // Fallback for environments without crypto.randomUUID.
  return `pp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Reads (or creates) the persisted anonymous id. `isReturning` reflects prior existence. */
export function getOrCreatePlayerId(): { id: string; isReturning: boolean } {
  try {
    const existing = localStorage.getItem(ANALYTICS_ID_KEY);
    if (existing) return { id: existing, isReturning: true };
    const id = uuid();
    localStorage.setItem(ANALYTICS_ID_KEY, id);
    return { id, isReturning: false };
  } catch {
    return { id: uuid(), isReturning: false };
  }
}

export function hasSavedRun(): boolean {
  try {
    return localStorage.getItem(GAME_SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function createSessionId(): string {
  return uuid();
}

export function getDeviceType(): DeviceType {
  if (typeof window === 'undefined' || !window.matchMedia) return 'desktop';
  if (window.matchMedia('(max-width: 640px)').matches) return 'mobile';
  if (window.matchMedia('(max-width: 1024px)').matches) return 'tablet';
  return 'desktop';
}

export function parseUtms(search: string): Utms {
  const params = new URLSearchParams(search);
  const out: Utms = {};
  const source = params.get('utm_source');
  const medium = params.get('utm_medium');
  const campaign = params.get('utm_campaign');
  if (source) out.utm_source = source;
  if (medium) out.utm_medium = medium;
  if (campaign) out.utm_campaign = campaign;
  return out;
}

/** Builds the property bag attached to every event. */
export function buildGlobalProps(anonymousPlayerId: string): GlobalProps {
  return {
    session_id: createSessionId(),
    anonymous_player_id: anonymousPlayerId,
    device_type: getDeviceType(),
    ...parseUtms(typeof window !== 'undefined' ? window.location.search : ''),
  };
}
