import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { HarvestCelebration, coinCounts } from '../../src/components/HarvestCelebration';
import type { DailyLogEntry, HarvestEvent } from '../../src/engine/types';

vi.mock('../../src/audio/sfx', () => ({
  playSfx: vi.fn(),
}));
import { playSfx } from '../../src/audio/sfx';

function makeHarvest(plotId: number, cropId: HarvestEvent['cropId'], adjustedYield: number): HarvestEvent {
  return { plotId, cropId, baseYield: adjustedYield, weatherMultiplier: 1, adjustedYield };
}

function makeLog(harvests: HarvestEvent[]): DailyLogEntry {
  return {
    day: 3,
    weatherId: 'sunny',
    weatherMultiplier: 1,
    harvests,
    totalHarvestIncome: harvests.reduce((a, h) => a + h.adjustedYield, 0),
    openingBalance: 100,
    landLeaseDeducted: 15,
    taxRate: 0.06,
    taxDeducted: 4,
    netChange: -7,
    closingBalance: 93,
    exhaustedPlots: [],
    pestDestroyedPlots: [],
    pestPlotsAtRisk: 0,
    flashDroughtDaysAfter: 0,
    streakBefore: 0,
    streakAfter: 1,
    streakBonus: 0,
    marketActive: null,
    marketAnnounced: null,
    buildingsApplied: [],
  };
}

/** Controllable WAAPI stub: collect animations, fire onfinish manually. */
class FakeAnimation {
  onfinish: (() => void) | null = null;
  cancel = vi.fn();
}

function installFakeWaapi() {
  const animations: FakeAnimation[] = [];
  HTMLElement.prototype.animate = vi.fn(() => {
    const a = new FakeAnimation();
    animations.push(a);
    return a as unknown as Animation;
  }) as unknown as typeof HTMLElement.prototype.animate;
  return animations;
}

function stubReducedMotion(matches: boolean) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

beforeEach(() => {
  vi.clearAllMocks();
  stubReducedMotion(false);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  // jsdom has no Element.animate; remove any stub we installed.
  delete (HTMLElement.prototype as { animate?: unknown }).animate;
});

describe('coinCounts', () => {
  it('scales coins with yield: radish 12 → 1, parsnip 28 → 2, pumpkin 65 → 4 (clamped)', () => {
    expect(coinCounts([12])).toEqual([1]);
    expect(coinCounts([28])).toEqual([2]);
    expect(coinCounts([65])).toEqual([4]);
  });

  it('caps the total at 20 coins, never trimming a plot below 1', () => {
    const counts = coinCounts(Array.from({ length: 12 }, () => 65));
    expect(counts.reduce((a, b) => a + b, 0)).toBe(20);
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(1);
  });
});

describe('HarvestCelebration — no WAAPI (jsdom default)', () => {
  it('resolves instantly: onDone and onCoinsArriving fire, nothing renders persistently', () => {
    const onDone = vi.fn();
    const onCoinsArriving = vi.fn();
    render(
      <HarvestCelebration
        log={makeLog([makeHarvest(0, 'radish', 12)])}
        onCoinsArriving={onCoinsArriving}
        onDone={onDone}
      />,
    );
    expect(onCoinsArriving).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('HarvestCelebration — full flight (WAAPI stubbed)', () => {
  it('renders one coin per coinCounts entry, capped at 20, inside an aria-hidden overlay', () => {
    installFakeWaapi();
    const log = makeLog(Array.from({ length: 12 }, (_, i) => makeHarvest(i, 'pumpkin', 65)));
    render(<HarvestCelebration log={log} onCoinsArriving={vi.fn()} onDone={vi.fn()} />);
    const overlay = screen.getByTestId('harvest-celebration');
    expect(overlay).toHaveAttribute('aria-hidden', 'true');
    expect(overlay.querySelectorAll('span')).toHaveLength(20);
  });

  it('plays one launch sound per harvested plot, mapped per crop', () => {
    installFakeWaapi();
    const log = makeLog([
      makeHarvest(0, 'radish', 12),
      makeHarvest(1, 'parsnip', 28),
      makeHarvest(2, 'pumpkin', 65),
    ]);
    render(<HarvestCelebration log={log} onCoinsArriving={vi.fn()} onDone={vi.fn()} />);
    act(() => {
      vi.advanceTimersByTime(2000); // fire all staggered launch timers
    });
    expect(playSfx).toHaveBeenCalledWith('harvest_radish');
    expect(playSfx).toHaveBeenCalledWith('harvest_parsnip');
    expect(playSfx).toHaveBeenCalledWith('harvest_pumpkin');
  });

  it('fires onCoinsArriving at the first landing and onDone only after all landings', () => {
    const animations = installFakeWaapi();
    const onDone = vi.fn();
    const onCoinsArriving = vi.fn();
    const log = makeLog([makeHarvest(0, 'parsnip', 28)]); // 2 coins
    render(<HarvestCelebration log={log} onCoinsArriving={onCoinsArriving} onDone={onDone} />);
    expect(animations).toHaveLength(2);

    act(() => animations[0].onfinish?.());
    expect(onCoinsArriving).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();

    act(() => animations[1].onfinish?.());
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('skips to done on window pointerdown, cancelling animations', () => {
    const animations = installFakeWaapi();
    const onDone = vi.fn();
    const log = makeLog([makeHarvest(0, 'pumpkin', 65)]);
    render(<HarvestCelebration log={log} onCoinsArriving={vi.fn()} onDone={onDone} />);
    act(() => {
      fireEvent.pointerDown(window);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(animations.some(a => a.cancel.mock.calls.length > 0)).toBe(true);
  });

  it('skips to done on window keydown', () => {
    installFakeWaapi();
    const onDone = vi.fn();
    render(
      <HarvestCelebration log={makeLog([makeHarvest(0, 'radish', 12)])} onCoinsArriving={vi.fn()} onDone={onDone} />,
    );
    act(() => {
      fireEvent.keyDown(window, { key: 'Enter' });
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('HarvestCelebration — reduced motion (sound-only)', () => {
  it('renders no coins, plays staggered crop sounds, then resolves', () => {
    stubReducedMotion(true);
    installFakeWaapi(); // must be ignored on this path
    const onDone = vi.fn();
    const log = makeLog([makeHarvest(0, 'radish', 12), makeHarvest(1, 'pumpkin', 65)]);
    render(<HarvestCelebration log={log} onCoinsArriving={vi.fn()} onDone={onDone} />);
    expect(screen.queryByTestId('harvest-celebration')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(playSfx).toHaveBeenCalledWith('harvest_radish');
    expect(playSfx).toHaveBeenCalledWith('harvest_pumpkin');
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
