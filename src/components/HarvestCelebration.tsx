import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import type { CropId, DailyLogEntry } from '../engine/types';
import { playSfx, type SfxId } from '../audio/sfx';
import { useReducedMotion } from '../hooks/useReducedMotion';

const GROUP_STAGGER_MS = 140;
/** Compress the stagger so the last group launches by here (spec §3). */
const MAX_LAST_LAUNCH_MS = 900;
const COIN_STAGGER_MS = 60;
const FLIGHT_MS = 600;
const MAX_COINS = 20;
const MAX_COINS_PER_PLOT = 4;
const YIELD_PER_COIN = 16;
const COIN_PING_THROTTLE_MS = 60;

const CROP_SFX: Record<CropId, SfxId> = {
  radish: 'harvest_radish',
  parsnip: 'harvest_parsnip',
  pumpkin: 'harvest_pumpkin',
};

/** Per-group launch stagger, matching the celebration's own cadence. */
function launchStagger(groupCount: number): number {
  return groupCount > 1 ? Math.min(GROUP_STAGGER_MS, MAX_LAST_LAUNCH_MS / (groupCount - 1)) : 0;
}

/**
 * 021 — sound-only harvest cue: the per-crop harvest chimes, staggered like the
 * full celebration but without any visuals. Used on season-boundary turns, where
 * the SeasonTransitionModal owns the stage so the coin flight is skipped but the
 * chime should still play. Returns a cleanup that cancels any pending timers.
 */
export function playHarvestSounds(harvests: DailyLogEntry['harvests']): () => void {
  const stagger = launchStagger(harvests.length);
  const timers = harvests.map((h, i) =>
    window.setTimeout(() => playSfx(CROP_SFX[h.cropId]), i * stagger),
  );
  return () => timers.forEach(id => window.clearTimeout(id));
}

/**
 * Coins per harvested plot: 1–4 scaled by yield, hard-capped at MAX_COINS
 * total by trimming the largest groups first (never below 1 per plot).
 * Exported for direct unit testing.
 */
export function coinCounts(yields: number[]): number[] {
  const counts = yields.map(y =>
    Math.max(1, Math.min(MAX_COINS_PER_PLOT, Math.ceil(y / YIELD_PER_COIN))),
  );
  let total = counts.reduce((a, b) => a + b, 0);
  while (total > MAX_COINS) {
    const max = Math.max(...counts);
    if (max <= 1) break;
    counts[counts.indexOf(max)] -= 1;
    total -= 1;
  }
  return counts;
}

interface Point {
  x: number;
  y: number;
}

function centerOf(el: Element): Point {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function plotOrigin(plotId: number): Point {
  const el = document.querySelector(`[data-plot-id="${plotId}"]`);
  // Fallback (spec §3): plot node missing → lower screen center.
  if (!el) return { x: window.innerWidth / 2, y: window.innerHeight * 0.75 };
  return centerOf(el);
}

function chipTarget(): Point {
  const el = document.querySelector('[data-coin-target]');
  if (!el) return { x: window.innerWidth / 2, y: 24 };
  return centerOf(el);
}

interface HarvestCelebrationProps {
  log: DailyLogEntry;
  /** First coin reached the chip — the HUD counter tick should start. */
  onCoinsArriving: () => void;
  /** Sequence fully resolved (or skipped) — parent should unmount us. */
  onDone: () => void;
}

/**
 * 021 — the harvest celebration overlay. Mounted by GameBoard when a
 * fresh-open harvest-day summary closes; unmounts itself via onDone. Purely
 * decorative (aria-hidden, pointer-events-none): gameplay state is already
 * committed before this ever renders.
 */
export function HarvestCelebration({ log, onCoinsArriving, onDone }: HarvestCelebrationProps) {
  const reducedMotion = useReducedMotion();
  const counts = useMemo(
    () => coinCounts(log.harvests.map(h => h.adjustedYield)),
    [log],
  );
  const totalCoins = counts.reduce((a, b) => a + b, 0);

  const coinRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const timersRef = useRef<number[]>([]);
  const animationsRef = useRef<Animation[]>([]);
  const doneRef = useRef(false);
  const arrivedRef = useRef(false);
  const finishRef = useRef<() => void>(() => {});

  // Parent callbacks in refs so the one-shot sequence effect never re-runs.
  // Synced in a layout effect (not during render) to avoid mutating refs in the
  // render body, while still landing before any paint or the sequence's finish.
  const onCoinsArrivingRef = useRef(onCoinsArriving);
  const onDoneRef = useRef(onDone);
  useLayoutEffect(() => {
    onCoinsArrivingRef.current = onCoinsArriving;
    onDoneRef.current = onDone;
  });

  // The whole sequence is one-shot per mount: GameBoard mounts a fresh
  // instance per celebration and the log cannot change mid-flight.
  useEffect(() => {
    const groups = log.harvests;
    const stagger = launchStagger(groups.length);

    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      timersRef.current.forEach(id => window.clearTimeout(id));
      animationsRef.current.forEach(a => a.cancel());
      if (!arrivedRef.current) {
        arrivedRef.current = true;
        onCoinsArrivingRef.current();
      }
      onDoneRef.current();
    };
    finishRef.current = finish;

    // Sound-only path (spec §3): reduced motion keeps the audio, drops the visuals.
    if (reducedMotion) {
      groups.forEach((h, i) => {
        timersRef.current.push(window.setTimeout(() => playSfx(CROP_SFX[h.cropId]), i * stagger));
      });
      timersRef.current.push(
        window.setTimeout(finish, Math.max(0, groups.length - 1) * stagger + 300),
      );
      return () => {
        timersRef.current.forEach(id => window.clearTimeout(id));
      };
    }

    // No Web Animations API (jsdom, ancient browsers): resolve instantly (spec §3).
    if (typeof HTMLElement.prototype.animate !== 'function') {
      finish();
      return;
    }

    const target = chipTarget();
    const chipEl = document.querySelector('[data-coin-target]') as HTMLElement | null;
    let landed = 0;
    let launched = 0;
    let lastPing = 0;
    let coinIndex = 0;

    groups.forEach((h, gi) => {
      const origin = plotOrigin(h.plotId);
      const launchDelay = gi * stagger;
      timersRef.current.push(
        window.setTimeout(() => playSfx(CROP_SFX[h.cropId]), launchDelay),
      );

      for (let j = 0; j < counts[gi]; j++) {
        const el = coinRefs.current[coinIndex];
        coinIndex += 1;
        if (!el) continue;
        const jitterX = (Math.random() - 0.5) * 40;
        const jitterY = (Math.random() - 0.5) * 40;
        el.style.left = `${origin.x + jitterX}px`;
        el.style.top = `${origin.y + jitterY}px`;
        const dx = target.x - origin.x - jitterX;
        const dy = target.y - origin.y - jitterY;
        const anim = el.animate(
          [
            { transform: 'translate(-50%, -50%)', opacity: 0.9 },
            // Arc: overshoot upward at the midpoint before easing into the chip.
            {
              transform: `translate(calc(${dx * 0.5}px - 50%), calc(${dy * 0.5 - 60}px - 50%))`,
              opacity: 1,
              offset: 0.5,
            },
            { transform: `translate(calc(${dx}px - 50%), calc(${dy}px - 50%))`, opacity: 1 },
          ],
          { duration: FLIGHT_MS, delay: launchDelay + j * COIN_STAGGER_MS, easing: 'ease-in', fill: 'both' },
        );
        launched += 1;
        anim.onfinish = () => {
          if (doneRef.current) return;
          el.style.visibility = 'hidden';
          landed += 1;
          if (!arrivedRef.current) {
            arrivedRef.current = true;
            onCoinsArrivingRef.current();
          }
          const now = performance.now();
          if (now - lastPing >= COIN_PING_THROTTLE_MS) {
            lastPing = now;
            playSfx('coin_land');
          }
          if (chipEl && typeof chipEl.animate === 'function') {
            chipEl.animate(
              [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }],
              { duration: 150 },
            );
          }
          if (landed >= launched) finish();
        };
        animationsRef.current.push(anim);
      }
    });

    if (launched === 0) {
      finish();
      return;
    }

    return () => {
      timersRef.current.forEach(id => window.clearTimeout(id));
      animationsRef.current.forEach(a => a.cancel());
    };
    // One-shot per mount by design — see comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Skip on any input. Registered in an effect, which runs only after the
  // event that closed the modal has fully dispatched — so that click/Escape
  // can never skip the celebration it just started (spec §3).
  useEffect(() => {
    const skip = () => finishRef.current();
    window.addEventListener('pointerdown', skip);
    window.addEventListener('keydown', skip);
    return () => {
      window.removeEventListener('pointerdown', skip);
      window.removeEventListener('keydown', skip);
    };
  }, []);

  if (reducedMotion) return null;

  return ReactDOM.createPortal(
    <div
      aria-hidden="true"
      data-testid="harvest-celebration"
      className="fixed inset-0 z-[60] pointer-events-none"
    >
      {Array.from({ length: totalCoins }, (_, i) => (
        <span
          key={i}
          ref={el => {
            coinRefs.current[i] = el;
          }}
          className="fixed text-xl"
          style={{ left: -100, top: -100, transform: 'translate(-50%, -50%)' }}
        >
          🪙
        </span>
      ))}
    </div>,
    document.body,
  );
}
