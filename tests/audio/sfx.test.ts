import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AUDIO_KEY,
  RECIPES,
  isMuted,
  setMuted,
  playSfx,
  _resetAudioContextForTests,
  type SfxId,
} from '../../src/audio/sfx';

const ALL_IDS: SfxId[] = ['harvest_radish', 'harvest_parsnip', 'harvest_pumpkin', 'coin_land'];

class FakeOsc {
  type = 'sine';
  frequency = { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
  connect = vi.fn((node: unknown) => node);
  start = vi.fn();
  stop = vi.fn();
}

class FakeGain {
  gain = {
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  connect = vi.fn((node: unknown) => node);
}

function installFakeAudioContext() {
  const oscillators: FakeOsc[] = [];
  const ctx = {
    currentTime: 0,
    state: 'running',
    resume: vi.fn(),
    destination: {},
    createOscillator: vi.fn(() => {
      const o = new FakeOsc();
      oscillators.push(o);
      return o;
    }),
    createGain: vi.fn(() => new FakeGain()),
  };
  vi.stubGlobal('AudioContext', vi.fn(function () { return ctx; }));
  return { ctx, oscillators };
}

beforeEach(() => {
  localStorage.clear();
  _resetAudioContextForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sfx — mute persistence', () => {
  it('defaults to unmuted', () => {
    expect(isMuted()).toBe(false);
  });

  it('persists mute across a fresh read', () => {
    setMuted(true);
    expect(isMuted()).toBe(true);
    expect(JSON.parse(localStorage.getItem(AUDIO_KEY)!)).toEqual({ schemaVersion: 1, muted: true });
    setMuted(false);
    expect(isMuted()).toBe(false);
  });

  it('never throws on malformed stored JSON and falls back to unmuted', () => {
    localStorage.setItem(AUDIO_KEY, '{not json!!');
    expect(isMuted()).toBe(false);
    localStorage.setItem(AUDIO_KEY, JSON.stringify({ muted: 'yes-please' }));
    expect(isMuted()).toBe(false);
  });
});

describe('sfx — recipes', () => {
  it('has a non-empty recipe for every SfxId', () => {
    for (const id of ALL_IDS) {
      expect(RECIPES[id].length).toBeGreaterThan(0);
    }
  });
});

describe('sfx — playSfx', () => {
  it('no-ops (no throw) when AudioContext is unavailable (jsdom default)', () => {
    expect(window.AudioContext).toBeUndefined();
    expect(() => playSfx('harvest_radish')).not.toThrow();
  });

  it('creates one oscillator per recipe note', () => {
    const { oscillators } = installFakeAudioContext();
    playSfx('harvest_parsnip'); // two-note recipe
    expect(oscillators).toHaveLength(2);
    expect(oscillators[0].start).toHaveBeenCalled();
  });

  it('applies a frequency slide for notes with f1', () => {
    const { oscillators } = installFakeAudioContext();
    playSfx('harvest_radish');
    expect(oscillators).toHaveLength(1);
    expect(oscillators[0].frequency.exponentialRampToValueAtTime).toHaveBeenCalled();
  });

  it('plays nothing while muted', () => {
    const { oscillators } = installFakeAudioContext();
    setMuted(true);
    playSfx('coin_land');
    expect(oscillators).toHaveLength(0);
  });

  it('reuses one AudioContext across plays and resumes a suspended one', () => {
    const { ctx } = installFakeAudioContext();
    playSfx('coin_land');
    playSfx('coin_land');
    expect(vi.mocked(window.AudioContext)).toHaveBeenCalledTimes(1);
    (ctx as { state: string }).state = 'suspended';
    playSfx('coin_land');
    expect(ctx.resume).toHaveBeenCalled();
  });
});
