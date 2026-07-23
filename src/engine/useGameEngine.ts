import { useState, useCallback, useEffect, useRef } from 'react';
import {
  initialGameState,
  plantSeed,
  processTurn,
  buySeed as engineBuySeed,
  buyFertilizer as engineBuyFertilizer,
  applyFertilizer as engineApplyFertilizer,
  clearPestDamage as engineClearPestDamage,
  buyPlot as engineBuyPlot,
  getNextPlotPrice as engineGetNextPlotPrice,
  buyBuilding as engineBuyBuilding,
  computeSeedCost,
  resolveFarmEventChoice as engineResolveFarmEventChoice,
} from './gameEngine';
import { SCHEMA_VERSION, NO_BUILDINGS, WEATHER_DEFINITIONS } from './constants';
import { FARM_EVENT_DEFINITIONS } from './farmEventCatalog';
import { DEFAULT_ECONOMY } from './economy';
import { resolveEconomy } from '../devFlags';
import type {
  GameState,
  CropId,
  DailyLogEntry,
  MarketState,
  MarketEvent,
  ActiveMarketEvent,
  MarketEventKind,
  WeatherId,
  BuildingId,
  BuildingDefinition,
  FarmEventsState,
  FarmEventId,
  ContractState,
  FarmEventEffect,
  FarmEventChoiceId,
  FarmEventDefinition,
} from './types';
import { recordRunEnd, loadRecords, type PersonalBests } from './records';
import { EMPTY_FARM_EVENTS, merchantOfferValue } from './farmEvents';
import { deriveMedal, type Medal } from './medals';
import { getSeasonForDay } from './seasons';
import { EMPTY_MARKET } from './market';
import { trackPlayStartedOnce } from '../analytics/track';
import { loadOnboarding } from './onboarding';

const STORAGE_KEY = 'pixel-parsnips-state';

/** Resolved once per session; the URL can't change mid-session without a reload. */
const ECONOMY = resolveEconomy();

/** Minimal structural check that `state` looks like a GameState payload. */
function isGameStateShape(state: unknown): state is Record<string, unknown> {
  return typeof state === 'object' && state !== null && 'phase' in state && 'plots' in state;
}

const isCropId = (v: unknown): v is CropId =>
  v === 'radish' || v === 'parsnip' || v === 'pumpkin';
const isKind = (v: unknown): v is MarketEventKind => v === 'shortage' || v === 'glut';

/** Structurally validate a pending (announced) event, or null if malformed. */
function toPendingEvent(v: unknown): MarketEvent | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const e = v as Record<string, unknown>;
  if (!isCropId(e.cropId) || !isKind(e.kind) || typeof e.multiplier !== 'number') return null;
  return { cropId: e.cropId, kind: e.kind, multiplier: e.multiplier };
}

/** Structurally validate an active event (pending shape + daysRemaining), or null. */
function toActiveEvent(v: unknown): ActiveMarketEvent | null {
  const base = toPendingEvent(v);
  if (base === null) return null;
  const daysRemaining = (v as Record<string, unknown>).daysRemaining;
  if (typeof daysRemaining !== 'number') return null;
  return { ...base, daysRemaining: Math.max(0, Math.floor(daysRemaining)) };
}

/**
 * Normalize a raw `market` value from a (possibly tampered) save. Accepts only
 * structurally valid active/pending events and enforces the one-at-a-time
 * invariant (active wins) so malformed shapes like `{}`, arrays, or both slots
 * populated cannot leak into the turn/log/render paths.
 */
function normalizeMarket(raw: unknown): MarketState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...EMPTY_MARKET };
  const m = raw as Record<string, unknown>;
  const active = toActiveEvent(m.active);
  if (active) return { active, pending: null };
  return { active: null, pending: toPendingEvent(m.pending) };
}

/** Normalize a raw `buildings` value from a save: missing/malformed → all false. */
function normalizeBuildings(raw: unknown): GameState['buildings'] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...NO_BUILDINGS };
  const r = raw as Record<string, unknown>;
  return {
    toolshed: r.toolshed === true,
    compost_bin: r.compost_bin === true,
    irrigation_well: r.irrigation_well === true,
    scarecrow: r.scarecrow === true,
    farm_stand: r.farm_stand === true,
  };
}

/** 022 gate: events unlock from a device's second run onward. */
function defaultFarmEventsEnabled(): boolean {
  return loadRecords().totalRunsCompleted >= 1;
}

const FARM_EVENT_IDS: readonly FarmEventId[] = FARM_EVENT_DEFINITIONS.map(d => d.id);
const isFarmEventId = (v: unknown): v is FarmEventId =>
  (FARM_EVENT_IDS as readonly unknown[]).includes(v);

const WEATHER_IDS: readonly WeatherId[] = Object.keys(WEATHER_DEFINITIONS) as WeatherId[];
const isWeatherId = (v: unknown): v is WeatherId =>
  (WEATHER_IDS as readonly unknown[]).includes(v);

const isNumber = (v: unknown): v is number => typeof v === 'number';

/** Structurally validate a pending (announced) farm event, or null if malformed. */
function toPendingFarmEvent(v: unknown): FarmEventsState['pending'] {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const p = v as Record<string, unknown>;
  return isFarmEventId(p.eventId) && isNumber(p.firedDay)
    ? { eventId: p.eventId, firedDay: p.firedDay }
    : null;
}

/** Structurally validate a live contract, or null if any field is missing/malformed. */
function toContractState(v: unknown): ContractState | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const c = v as Record<string, unknown>;
  if (
    !isFarmEventId(c.eventId) || !isCropId(c.cropId) ||
    !isNumber(c.quantity) || !isNumber(c.remaining) ||
    !isNumber(c.deadlineDay) || !isNumber(c.reward)
  ) {
    return null;
  }
  return {
    eventId: c.eventId, cropId: c.cropId, quantity: c.quantity,
    remaining: c.remaining, deadlineDay: c.deadlineDay, reward: c.reward,
  };
}

/** Per-variant payload validators keyed by effect kind. Split out so each stays
 *  trivial and `isLiveFarmEffect` doesn't blow the complexity budget. */
const LIVE_EFFECT_VALIDATORS: Record<string, (x: Record<string, unknown>) => boolean> = {
  yield_buff: x => isNumber(x.multiplier) && isNumber(x.harvestsRemaining) && isNumber(x.exhaustionFactor),
  seed_discount: x => isCropId(x.cropId) && isNumber(x.factor) && isNumber(x.expiresAfterDay),
  weather_pin: x => isWeatherId(x.weatherId) && isNumber(x.day),
};

/** A structurally valid live (counter-bearing) effect. Validates every payload
 *  field per variant so a tampered save can't leak a bogus weatherId/NaN into the
 *  turn engine (pinnedWeatherFor → WEATHER_DEFINITIONS lookup, yield multipliers). */
function isLiveFarmEffect(e: unknown): e is FarmEventEffect {
  if (!e || typeof e !== 'object') return false;
  const x = e as Record<string, unknown>;
  const validate = LIVE_EFFECT_VALIDATORS[x.kind as string];
  return validate !== undefined && validate(x);
}

/** Normalize a raw `farmEvents` value from a save: missing/malformed → empty slice
 *  with the records-derived enabled flag. Structurally valid fields pass through;
 *  anything suspect degrades to its empty value (never crashes, never blocks). */
function normalizeFarmEvents(raw: unknown, fallbackEnabled: boolean): FarmEventsState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...EMPTY_FARM_EVENTS, enabled: fallbackEnabled };
  }
  const r = raw as Record<string, unknown>;
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : fallbackEnabled,
    scheduleSeason: typeof r.scheduleSeason === 'number' ? r.scheduleSeason : 0,
    scheduledDays: Array.isArray(r.scheduledDays) ? r.scheduledDays.filter(isNumber) : [],
    pending: toPendingFarmEvent(r.pending),
    activeEffects: Array.isArray(r.activeEffects) ? r.activeEffects.filter(isLiveFarmEffect) : [],
    contract: toContractState(r.contract),
    seenIds: Array.isArray(r.seenIds) ? r.seenIds.filter(isFarmEventId) : [],
    lastResolved: null, // analytics-only; safe to drop on load
  };
}

/** v8 → v9: any owned tool tier becomes the Toolshed; the tier field is dropped. */
function migrateLadderToBuildings(st: Record<string, unknown>): Record<string, unknown> {
  const tier = typeof st.upgradeTier === 'number' ? st.upgradeTier : 0;
  const { upgradeTier: _dropped, ...rest } = st;
  return { ...rest, buildings: { ...NO_BUILDINGS, toolshed: tier >= 1 } };
}

/**
 * Hardens a current-schema save against tampering/corruption before use.
 * Downstream code (state.plots.every, plots.map, getNextPlotPrice, market
 * helpers) assumes plots is an array, unlockedPlots is a number in
 * [0, plots.length], and market is a normalized object with active/pending.
 */
function hardenCurrentSchema(st: Record<string, unknown>): GameState {
  const plots = Array.isArray(st.plots) ? st.plots : [];
  const rawUnlocked = Number(st.unlockedPlots);
  // A missing/non-numeric unlockedPlots defaults to "all visible plots
  // unlocked" so the run stays playable; any value is then clamped in range.
  const unlockedPlots = Math.max(
    0,
    Math.min(Number.isNaN(rawUnlocked) ? plots.length : rawUnlocked, plots.length),
  );
  const market = normalizeMarket(st.market);
  const buildings = normalizeBuildings(st.buildings);
  const farmEvents = normalizeFarmEvents(st.farmEvents, defaultFarmEventsEnabled());
  return {
    ...(st as unknown as GameState),
    plots,
    unlockedPlots,
    market,
    buildings,
    farmEvents,
    schemaVersion: SCHEMA_VERSION,
  } as GameState;
}

/** Migrates a parsed save envelope to the current schema, or returns null if unsupported. */
function migrateState(parsed: { schemaVersion: number; state: unknown }): GameState | null {
  // A non-shape state is unmigratable and falls through to "discard" (null) in
  // every branch anyway, so reject it up front. This removes one condition from
  // each version branch below without changing behavior.
  if (!isGameStateShape(parsed.state)) {
    console.info(
      `[PixelParsnips] Discarding malformed or unsupported save (v${parsed.schemaVersion}) — starting a new game.`
    );
    return null;
  }

  // Schema 10 — current. Harden tampered/corrupt fields in place.
  if (parsed.schemaVersion === SCHEMA_VERSION) {
    return hardenCurrentSchema(parsed.state as Record<string, unknown>);
  }

  // Schema 9 → 10 — add farm events (022); enabled derives from completed-run records.
  if (parsed.schemaVersion === 9) {
    console.info('[PixelParsnips] Migrating save from v9 to v10 (Farm Events).');
    return hardenCurrentSchema({
      ...(parsed.state as Record<string, unknown>),
      schemaVersion: SCHEMA_VERSION,
    });
  }

  return migrateLegacy(parsed);
}

/** Migrates pre-v9 save envelopes (v3–v8) forward to the current schema, or null if unsupported. */
function migrateLegacy(parsed: { schemaVersion: number; state: unknown }): GameState | null {
  // Schema 8 → 10 — collapse the tool ladder into the Toolshed building (019)
  if (parsed.schemaVersion === 8) {
    console.info('[PixelParsnips] Migrating save from v8 to v10 (Farm Buildings — tool tiers become the Toolshed; T1 owners gain a little, T3 owners lose the last 20%).');
    return hardenCurrentSchema({
      ...migrateLadderToBuildings(parsed.state as Record<string, unknown>),
      schemaVersion: SCHEMA_VERSION,
    });
  }

  // Schema 7 → 10 — add market (existing runs continue with no event) + ladder collapse
  if (parsed.schemaVersion === 7) {
    console.info('[PixelParsnips] Migrating save from v7 to v10 (Market Events + Farm Buildings).');
    const st = parsed.state as Record<string, unknown>;
    return hardenCurrentSchema({
      ...migrateLadderToBuildings(st),
      schemaVersion: SCHEMA_VERSION,
      market: { active: null, pending: null },
    });
  }

  // Schema 6 → 10 — add unlockedPlots (existing runs keep all plots unlocked) + market + ladder collapse
  if (parsed.schemaVersion === 6) {
    console.info('[PixelParsnips] Migrating save from v6 to v10 (Plot Progression + Market Events + Farm Buildings).');
    const st = parsed.state as Record<string, unknown>;
    return hardenCurrentSchema({
      ...migrateLadderToBuildings(st),
      schemaVersion: SCHEMA_VERSION,
      unlockedPlots: Array.isArray(st.plots) ? st.plots.length : DEFAULT_ECONOMY.maxPlots,
      market: { active: null, pending: null },
    });
  }

  // Schema 5 → 10 — add harvestStreak, peakHarvestStreak, unlockedPlots, market, and ladder collapse
  if (parsed.schemaVersion === 5) {
    console.info('[PixelParsnips] Migrating save from v5 to v10 (Harvest Streak + Plot Progression + Market Events + Farm Buildings).');
    return hardenCurrentSchema({
      ...migrateLadderToBuildings(parsed.state as Record<string, unknown>),
      schemaVersion: SCHEMA_VERSION,
      harvestStreak: 0,
      peakHarvestStreak: 0,
      unlockedPlots: DEFAULT_ECONOMY.maxPlots,
      market: { active: null, pending: null },
    });
  }

  // Schema 4 → 10 — chained: add disastersSurvived + streak fields + unlockedPlots + market + ladder collapse
  if (parsed.schemaVersion === 4) {
    console.info('[PixelParsnips] Migrating save from v4 to v10.');
    return hardenCurrentSchema({
      ...migrateLadderToBuildings(parsed.state as Record<string, unknown>),
      schemaVersion: SCHEMA_VERSION,
      disastersSurvived: 0,
      harvestStreak: 0,
      peakHarvestStreak: 0,
      unlockedPlots: DEFAULT_ECONOMY.maxPlots,
      market: { active: null, pending: null },
    });
  }

  // Schema 3 → 10 — chained: add endlessMode + disastersSurvived + streak fields + unlockedPlots + market + ladder collapse
  if (parsed.schemaVersion === 3) {
    console.info('[PixelParsnips] Migrating save from v3 to v10 (Season System + Enriched Run Summary + Harvest Streak + Plot Progression + Market Events + Farm Buildings).');
    return hardenCurrentSchema({
      ...migrateLadderToBuildings(parsed.state as Record<string, unknown>),
      schemaVersion: SCHEMA_VERSION,
      endlessMode: false,
      disastersSurvived: 0,
      harvestStreak: 0,
      peakHarvestStreak: 0,
      unlockedPlots: DEFAULT_ECONOMY.maxPlots,
      market: { active: null, pending: null },
    });
  }

  // Unrecognised / malformed save — discard
  console.info(
    `[PixelParsnips] Discarding malformed or unsupported save (v${parsed.schemaVersion}) — starting a new game.`
  );
  return null;
}

function loadState(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialGameState(ECONOMY, { farmEventsEnabled: defaultFarmEventsEnabled() });
    const parsed = JSON.parse(raw);
    return migrateState(parsed) ?? initialGameState(ECONOMY, { farmEventsEnabled: defaultFarmEventsEnabled() });
  } catch {
    return initialGameState(ECONOMY, { farmEventsEnabled: defaultFarmEventsEnabled() });
  }
}

function saveState(state: GameState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, state }));
}

export interface EndOfRunRecap {
  records: PersonalBests;
  newBests: Set<keyof PersonalBests>;
  medal: Medal;
  seasonReached: number;
}

export interface BuildingCardData {
  def: BuildingDefinition;
  owned: boolean;
  unlocked: boolean;
}

export interface PendingFarmEventView {
  def: FarmEventDefinition;
  /** Live sell-now estimate (Traveling Merchant); 0 for other events. */
  offerValue: number;
  balance: number;
  /** True during the player's second run (totalRunsCompleted === 1) — the
      feature just unlocked. Read fresh on every call so it stays correct even
      when a run restarts in place (GameBoard is not remounted between runs). */
  isNew: boolean;
}

export interface GameEngineHook {
  state: GameState;
  lastDailyLog: DailyLogEntry | null;
  endOfRunRecap: EndOfRunRecap | null;
  nextDay: (weatherOverride?: WeatherId) => void;
  plantSeed: (plotId: number, cropId: CropId) => boolean;
  buySeed: (cropId: CropId, quantity: number) => boolean;
  buyFertilizer: (quantity: number) => boolean;
  applyFertilizer: (plotId: number) => boolean;
  clearPestDamage: (plotId: number) => boolean;
  buyPlot: () => boolean;
  buyBuilding: (id: BuildingId) => boolean;
  getBuildingCards: () => BuildingCardData[];
  getFertilizerCount: () => number;
  restart: () => void;
  continueSeason: () => void;
  endRunVictory: () => void;
  getSeedPrice: (cropId: CropId) => number;
  getSeedYieldMultiplier: () => number;
  getNextPlotPrice: () => number | null;
  getOccupiedPlotCount: () => number;
  getRecoveryDays: () => number;
  resolveFarmEvent: (choice: FarmEventChoiceId) => boolean;
  getPendingFarmEvent: () => PendingFarmEventView | null;
}

export function useGameEngine(): GameEngineHook {
  const [state, setState] = useState<GameState>(() => loadState());
  const hasHydratedRef = useRef(false);
  const [endOfRunRecap, setEndOfRunRecap] = useState<EndOfRunRecap | null>(null);
  const prevPhaseRef = useRef<GameState['phase']>(state.phase);

  // Mirror state in a ref so action callbacks can read the latest value synchronously.
  // setState's function updater runs lazily, so reading inside it can't drive a synchronous return.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  // Commit a new state by updating the ref *and* React state together. The
  // mirroring effect above only runs after commit, so two mutating actions in
  // the same event (e.g. plant then nextDay) would both read the same stale
  // snapshot and the later setState would drop the earlier update. Writing the
  // ref synchronously here keeps chained actions building on each other.
  const commitState = useCallback((next: GameState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const hasSignaledPlayStartedRef = useRef(false);
  const signalPlayStarted = useCallback((action: string) => {
    if (hasSignaledPlayStartedRef.current) return;
    hasSignaledPlayStartedRef.current = true;
    const s = stateRef.current;
    trackPlayStartedOnce({
      start_action: action,
      day: s.currentDay,
      onboarding_active: !loadOnboarding().completed && s.currentDay <= 1,
      events_enabled: s.farmEvents.enabled,
    });
  }, []);

  useEffect(() => {
    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true;
      return;
    }
    saveState(state);
  }, [state]);

  // Fire recordRunEnd on the first terminal-phase transition per run.
  useEffect(() => {
    const prev = prevPhaseRef.current;
    const curr = state.phase;
    prevPhaseRef.current = curr;

    if (prev === curr) return;

    const isTerminalTransition =
      (curr === 'bankrupt' && prev !== 'bankrupt') ||
      (curr === 'season_4_won' && prev !== 'season_4_won' && !state.endlessMode);

    if (!isTerminalTransition) return;

    const { records, newBests } = recordRunEnd(state);
    const won = state.endlessMode || curr === 'season_4_won';
    const seasonReached = getSeasonForDay(state.currentDay, ECONOMY).number;
    setEndOfRunRecap({
      records,
      newBests,
      medal: deriveMedal(seasonReached, won),
      seasonReached,
    });
  // Intentionally listing individual state fields rather than the whole `state` object to avoid
  // re-firing on every state change. The prevPhaseRef guard prevents double-firing on re-renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.endlessMode, state.currentDay, state.peakBalance, state.disastersSurvived]);

  const nextDay = useCallback((weatherOverride?: WeatherId) => {
    signalPlayStarted('next_day');
    // processTurn is impure (consumes Math.random for weather/pest/market rolls),
    // so it must not run inside a setState updater — StrictMode double-invokes
    // updaters/reducers, and an impure call there can diverge between the kept
    // and discarded invocations. Read the authoritative snapshot from stateRef
    // and call processTurn exactly once, matching every other action below.
    commitState(processTurn(stateRef.current, weatherOverride, undefined, undefined, ECONOMY).state);
  }, [commitState, signalPlayStarted]);

  const plant = useCallback((plotId: number, cropId: CropId): boolean => {
    const result = plantSeed(stateRef.current, plotId, cropId, ECONOMY);
    if (!result.ok) return false;
    signalPlayStarted('plant');
    commitState(result.state);
    return true;
  }, [commitState, signalPlayStarted]);

  const buySeed = useCallback((cropId: CropId, quantity: number): boolean => {
    const result = engineBuySeed(stateRef.current, cropId, quantity, ECONOMY);
    if (!result.ok) return false;
    signalPlayStarted('buy_seed');
    commitState(result.state);
    return true;
  }, [commitState, signalPlayStarted]);

  const buyFertilizer = useCallback((quantity: number): boolean => {
    const result = engineBuyFertilizer(stateRef.current, quantity, ECONOMY);
    if (!result.ok) return false;
    signalPlayStarted('buy_fertilizer');
    commitState(result.state);
    return true;
  }, [commitState, signalPlayStarted]);

  const applyFertilizer = useCallback((plotId: number): boolean => {
    const result = engineApplyFertilizer(stateRef.current, plotId, ECONOMY);
    if (!result.ok) return false;
    signalPlayStarted('apply_fertilizer');
    commitState(result.state);
    return true;
  }, [commitState, signalPlayStarted]);

  const clearPestDamage = useCallback((plotId: number): boolean => {
    const result = engineClearPestDamage(stateRef.current, plotId, ECONOMY);
    if (!result.ok) return false;
    signalPlayStarted('clear_pest');
    commitState(result.state);
    return true;
  }, [commitState, signalPlayStarted]);

  const buyPlot = useCallback((): boolean => {
    const result = engineBuyPlot(stateRef.current, ECONOMY);
    if (!result.ok) return false;
    signalPlayStarted('buy_plot');
    commitState(result.state);
    return true;
  }, [commitState, signalPlayStarted]);

  const getNextPlotPrice = useCallback((): number | null => {
    return engineGetNextPlotPrice(state, ECONOMY);
  }, [state]);

  const buyBuilding = useCallback((id: BuildingId): boolean => {
    const result = engineBuyBuilding(stateRef.current, id, ECONOMY);
    if (!result.ok) return false;
    signalPlayStarted('buy_building');
    commitState(result.state);
    return true;
  }, [commitState, signalPlayStarted]);

  const resolveFarmEvent = useCallback((choice: FarmEventChoiceId): boolean => {
    const prev = stateRef.current;
    if (prev.farmEvents.pending === null) return false;
    const next = engineResolveFarmEventChoice(prev, choice, ECONOMY);
    if (next === prev) return false; // unaffordable buy-in — modal stays up
    signalPlayStarted('farm_event_choice');
    commitState(next);
    return true;
  }, [commitState, signalPlayStarted]);

  const getPendingFarmEvent = useCallback((): PendingFarmEventView | null => {
    const pending = state.farmEvents.pending;
    if (pending === null) return null;
    const def = ECONOMY.farmEvents.events.find(e => e.id === pending.eventId);
    if (def === undefined) return null;
    return {
      def,
      offerValue: merchantOfferValue(state, ECONOMY),
      balance: state.coinBalance,
      isNew: loadRecords().totalRunsCompleted === 1,
    };
  }, [state]);

  const getBuildingCards = useCallback((): BuildingCardData[] => {
    const season = getSeasonForDay(state.currentDay, ECONOMY).number;
    return ECONOMY.buildings.definitions.map(def => ({
      def,
      owned: state.buildings[def.id],
      unlocked: season >= def.unlockSeason,
    }));
  }, [state.currentDay, state.buildings]);

  const restart = useCallback(() => {
    const fresh = initialGameState(ECONOMY, { farmEventsEnabled: defaultFarmEventsEnabled() });
    setEndOfRunRecap(null);
    prevPhaseRef.current = fresh.phase;
    commitState(fresh);
  }, [commitState]);

  const continueSeason = useCallback(() => {
    const prev = stateRef.current;
    if (prev.phase === 'season_passed') {
      commitState({ ...prev, phase: 'playing' });
    } else if (prev.phase === 'season_4_won') {
      commitState({ ...prev, phase: 'playing', endlessMode: true, currentDay: prev.currentDay + 1 });
    }
  }, [commitState]);

  const endRunVictory = useCallback(() => {
    const fresh = initialGameState(ECONOMY, { farmEventsEnabled: defaultFarmEventsEnabled() });
    setEndOfRunRecap(null);
    prevPhaseRef.current = fresh.phase;
    commitState(fresh);
  }, [commitState]);

  const getSeedPrice = useCallback(
    (cropId: CropId): number => computeSeedCost(cropId, state.buildings, ECONOMY),
    [state.buildings]
  );

  const getOccupiedPlotCount = useCallback(
    () => state.plots.filter(p => p.cropId !== null).length,
    [state.plots]
  );

  const getFertilizerCount = useCallback(
    () => state.fertilizerInventory,
    [state.fertilizerInventory]
  );

  const getRecoveryDays = useCallback(
    () => (state.buildings.compost_bin
      ? ECONOMY.buildings.exhaustionRecoveryDays
      : ECONOMY.exhaustionRecoveryDays),
    [state.buildings.compost_bin]
  );

  // Flat yield factor the shop applies to displayed yield/profit so cards match
  // the harvest engine's Farm Stand `stallMod` (gameEngine). 1 when not owned.
  const getSeedYieldMultiplier = useCallback(
    () => (state.buildings.farm_stand ? ECONOMY.buildings.yieldMultiplier : 1),
    [state.buildings.farm_stand]
  );

  return {
    state,
    lastDailyLog: state.lastDailyLog,
    endOfRunRecap,
    nextDay,
    plantSeed: plant,
    buySeed,
    buyFertilizer,
    applyFertilizer,
    clearPestDamage,
    buyPlot,
    buyBuilding,
    getBuildingCards,
    getFertilizerCount,
    restart,
    continueSeason,
    endRunVictory,
    getSeedPrice,
    getSeedYieldMultiplier,
    getNextPlotPrice,
    getOccupiedPlotCount,
    getRecoveryDays,
    resolveFarmEvent,
    getPendingFarmEvent,
  };
}
