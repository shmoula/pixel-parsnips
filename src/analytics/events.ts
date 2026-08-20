import type {
  BuildingId,
  CropId,
  DailyLogEntry,
  FarmEventChoiceId,
  FarmEventId,
  GameState,
  MarketEventKind,
  WeatherId,
} from '../engine/types';
import type { Medal } from '../engine/medals';
import type { OnboardingStep } from '../engine/onboarding';

export const ANALYTICS_SCHEMA_VERSION = 1;

export type MilestoneId = 'first_plot_unlocked' | 'season_2_reached';
export type RunOutcome = 'bankrupt' | 'season_failed' | 'won';
export type SeasonOutcome = 'season_passed' | 'season_failed' | 'season_4_won';

/** Tutorial steps that appear in the funnel — every step except the terminal 'done'. */
export type OnboardingFunnelStep = Exclude<OnboardingStep, 'done'>;

/** The full P0+P1 event surface. Property bags are event-specific; globals are merged in `track`. */
export interface EventPropsMap {
  page_loaded: {
    is_returning_player: boolean;
    has_saved_run: boolean;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
  };
  play_started: { start_action: string; day: number; onboarding_active: boolean; events_enabled: boolean };
  milestone_reached: { milestone: MilestoneId; day: number; season_number: number };
  day_completed: {
    day: number;
    season_number: number;
    weather_id: WeatherId;
    harvest_count: number;
    net_change: number;
    tax_deducted: number;
    lease_deducted: number;
    exhausted_plot_count: number;
    phase_after: GameState['phase'];
    /** 023 — 008 harvest streak. */
    streak_after: number;
    streak_bonus: number;
    /** 023 — 003 disasters. */
    pest_destroyed_count: number;
    pest_plots_at_risk: number;
    flash_drought_days_after: number;
    /** 023 — 012 market events. */
    market_event_kind: MarketEventKind | null;
    market_crop_id: CropId | null;
    /** 023 — 019 building effect, not just purchase. */
    buildings_applied: BuildingId[];
    /** 023 — 022 buff uptake and contract pressure. */
    event_buff_count: number;
    contract_active: boolean;
  };
  plot_unlocked: {
    unlocked_plots_after: number;
    price: number;
    coin_balance_after: number;
    /** 023 — restores the "median day of first plot unlock" KPI. */
    day: number;
    season_number: number;
  };
  season_completed: {
    season_number: number;
    outcome: SeasonOutcome;
    coin_balance: number;
    days_played: number;
  };
  run_ended: {
    outcome: RunOutcome;
    days_played: number;
    season_reached: number;
    peak_balance: number;
    disasters_survived: number;
    peak_harvest_streak: number;
    medal: Medal;
  };
  shop_purchased: {
    item_type: 'seed' | 'fertilizer' | 'building';
    item_id: string;
    quantity: number;
    cost: number;
    day: number;
    season_number: number;
    coin_balance_after: number;
  };
  onboarding_step_reached: { step: OnboardingFunnelStep; step_index: number };
  onboarding_completed: Record<string, never>;
  onboarding_skipped: { from_step: OnboardingFunnelStep; from_step_index: number };
  onboarding_replay_requested: Record<string, never>;
  empty_day_safeguard: {
    action: 'advanced' | 'cancelled';
    onboarding_active: boolean;
    day: number;
    coin_balance: number;
  };
  farm_event_fired: { event_id: FarmEventId; season: number; day: number };
  farm_event_choice: { event_id: FarmEventId; choice: FarmEventChoiceId; auto: boolean; day: number };
  contract_completed: { event_id: FarmEventId; reward: number };
  contract_expired: { event_id: FarmEventId };
}

export type AnalyticsEventName = keyof EventPropsMap;

/** Per-event schema version; bump the specific event when its shape changes. */
export const EVENT_VERSIONS: Record<AnalyticsEventName, number> = {
  page_loaded: 1,
  play_started: 2,
  milestone_reached: 1,
  day_completed: 2,
  plot_unlocked: 2,
  season_completed: 1,
  run_ended: 1,
  shop_purchased: 1,
  onboarding_step_reached: 1,
  onboarding_completed: 1,
  onboarding_skipped: 1,
  onboarding_replay_requested: 1,
  empty_day_safeguard: 1,
  farm_event_fired: 1,
  farm_event_choice: 1,
  contract_completed: 1,
  contract_expired: 1,
};

export function buildDayCompletedProps(
  log: DailyLogEntry,
  seasonNumber: number,
  phaseAfter: GameState['phase'],
): EventPropsMap['day_completed'] {
  return {
    day: log.day,
    season_number: seasonNumber,
    weather_id: log.weatherId,
    harvest_count: log.harvests.length,
    net_change: log.netChange,
    tax_deducted: log.taxDeducted,
    lease_deducted: log.landLeaseDeducted,
    exhausted_plot_count: log.exhaustedPlots.length,
    phase_after: phaseAfter,
    streak_after: log.streakAfter,
    streak_bonus: log.streakBonus,
    pest_destroyed_count: log.pestDestroyedPlots.length,
    pest_plots_at_risk: log.pestPlotsAtRisk,
    flash_drought_days_after: log.flashDroughtDaysAfter,
    market_event_kind: log.marketActive?.kind ?? null,
    market_crop_id: log.marketActive?.cropId ?? null,
    buildings_applied: log.buildingsApplied,
    event_buff_count: log.eventBuffsApplied?.length ?? 0,
    contract_active: log.contractProgress != null,
  };
}

export function runOutcomeForPhase(phase: GameState['phase']): RunOutcome | null {
  if (phase === 'bankrupt') return 'bankrupt';
  if (phase === 'season_failed') return 'season_failed';
  if (phase === 'season_4_won') return 'won';
  return null;
}

export function buildRunEndedProps(
  state: GameState,
  outcome: RunOutcome,
  seasonReached: number,
  medal: Medal,
): EventPropsMap['run_ended'] {
  return {
    outcome,
    days_played: state.currentDay,
    season_reached: seasonReached,
    peak_balance: state.peakBalance,
    disasters_survived: state.disastersSurvived,
    peak_harvest_streak: state.peakHarvestStreak,
    medal,
  };
}
