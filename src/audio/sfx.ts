/**
 * 021 — chiptune SFX for the harvest celebration (F1). All sounds are
 * synthesized with the Web Audio API — no binary assets, no licensing.
 *
 * Backend swap contract: call sites only ever use `playSfx(id)`. Replacing
 * these synth recipes with CC0 audio files later means rewriting this module's
 * internals (e.g. per-id <audio> playback) without touching any caller.
 *
 * Recipes were auditioned against a synth demo on 2026-07-19 (spec §4) — the
 * numbers are the picked variants, not placeholders to tune.
 */

export type SfxId = 'harvest_radish' | 'harvest_parsnip' | 'harvest_pumpkin' | 'coin_land';

export const AUDIO_KEY = 'pixel-parsnips-audio';

interface AudioPrefs {
  schemaVersion: 1;
  muted: boolean;
}

const DEFAULT_PREFS: AudioPrefs = { schemaVersion: 1, muted: false };

/** Returns defaults when missing or malformed; never throws (records.ts pattern). */
function loadAudioPrefs(): AudioPrefs {
  try {
    const raw = localStorage.getItem(AUDIO_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<AudioPrefs>;
    return { schemaVersion: 1, muted: parsed.muted === true };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function isMuted(): boolean {
  return loadAudioPrefs().muted;
}

export function setMuted(muted: boolean): void {
  try {
    localStorage.setItem(AUDIO_KEY, JSON.stringify({ schemaVersion: 1, muted }));
  } catch {
    // Storage full or disabled — non-fatal; the choice simply won't persist.
  }
}

interface SynthNote {
  /** Start offset within the sound, seconds. */
  t0: number;
  type: OscillatorType;
  /** Start frequency (Hz); slides to f1 when set. */
  f0: number;
  f1?: number;
  /** Note length, seconds. */
  dur: number;
  /** Peak gain, 0..1. */
  vol: number;
}

/** Exported for tests and for the future file-backend swap. */
export const RECIPES: Record<SfxId, SynthNote[]> = {
  harvest_radish: [{ t0: 0, type: 'square', f0: 880, f1: 1175, dur: 0.09, vol: 0.14 }],
  harvest_parsnip: [
    { t0: 0, type: 'square', f0: 587, dur: 0.08, vol: 0.14 },
    { t0: 0.09, type: 'square', f0: 880, dur: 0.12, vol: 0.14 },
  ],
  harvest_pumpkin: [
    { t0: 0, type: 'square', f0: 196, f1: 98, dur: 0.22, vol: 0.2 },
    { t0: 0, type: 'triangle', f0: 98, f1: 65, dur: 0.26, vol: 0.3 },
  ],
  coin_land: [
    { t0: 0, type: 'square', f0: 1319, dur: 0.04, vol: 0.09 },
    { t0: 0.045, type: 'square', f0: 1760, dur: 0.07, vol: 0.09 },
  ],
};

const ATTACK_S = 0.005;

let ctx: AudioContext | null = null;

export function _resetAudioContextForTests(): void {
  ctx = null;
}

/**
 * Lazily creates the shared AudioContext. Only ever called from inside a
 * user-gesture call stack (the click/keypress that closed the modal), so
 * browser autoplay policy is satisfied; resume() covers the suspended case.
 */
function getContext(): AudioContext | null {
  if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') return null;
  if (!ctx) {
    try {
      ctx = new window.AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Plays a sound by id. No-ops when muted or when Web Audio is unavailable. */
export function playSfx(id: SfxId): void {
  if (isMuted()) return;
  const c = getContext();
  if (!c) return;
  for (const n of RECIPES[id]) {
    const t = c.currentTime + n.t0;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = n.type;
    osc.frequency.setValueAtTime(n.f0, t);
    if (n.f1 !== undefined) osc.frequency.exponentialRampToValueAtTime(n.f1, t + n.dur);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(n.vol, t + ATTACK_S);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + n.dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + n.dur + 0.02);
  }
}
