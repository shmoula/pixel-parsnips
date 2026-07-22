import type { FarmEventDefinition } from './types';

/**
 * The authored Farm Event catalog (022). Data only — all behavior lives in
 * farmEvents.ts / gameEngine.ts. Choice B is always the decline/safe side
 * (the processTurn auto-resolve target). Numbers here are tuned in
 * specs/022-narrative-events/tuning-results.md before shipping.
 */
export const FARM_EVENT_DEFINITIONS: FarmEventDefinition[] = [
  {
    id: 'traveling_merchant',
    emoji: '🧳',
    title: 'The Traveling Merchant',
    body: 'A buyer pulls up with an empty cart and a full purse. She offers to take everything growing in your fields, right now — no waiting, no weather risk.',
    choiceA: {
      label: 'Sell everything now',
      summary: 'All growing crops sold instantly at 1.4× base value.',
      effects: [{ kind: 'sell_standing_crops', priceFactor: 1.4 }],
    },
    choiceB: { label: 'Decline', summary: 'Harvest on schedule.', effects: [] },
  },
  {
    id: 'bountiful_spring',
    emoji: '🌸',
    title: 'Bountiful Spring',
    body: 'The soil is unusually rich this week — worms everywhere, and the smell of rain. Push it hard, and the ground will pay you back… then need a rest.',
    choiceA: {
      label: 'Embrace it',
      summary: 'Next 3 harvests +50% coins, but soil exhausts twice as fast.',
      effects: [{ kind: 'yield_buff', multiplier: 1.5, harvests: 3, exhaustionFactor: 2 }],
    },
    choiceB: { label: 'Conserve', summary: 'Plant normally.', effects: [] },
  },
  {
    id: 'drought_warning',
    emoji: '🌵',
    title: 'Drought Warning',
    body: 'The almanac says a flash drought is likely within days. It has been wrong before — but not often.',
    onFire: [{ kind: 'weather_pin', weatherId: 'flash_drought', chance: 0.7, minOffsetDays: 2, maxOffsetDays: 3 }],
    choiceA: {
      label: 'Rush-plant',
      summary: 'Radish seeds half price — today only.',
      effects: [{ kind: 'seed_discount', cropId: 'radish', factor: 0.5 }],
    },
    choiceB: { label: 'Hold and wait', summary: 'Maybe it passes.', effects: [] },
  },
  {
    id: 'millers_order',
    emoji: '📜',
    title: "The Miller's Order",
    body: 'The miller needs parsnips for the harvest fair and pays over the odds for reliable growers. Miss the date and she simply buys elsewhere.',
    choiceA: {
      label: 'Take the contract',
      summary: 'Harvest 3 parsnips within 6 days → +55🪙 on delivery.',
      effects: [{ kind: 'contract', cropId: 'parsnip', quantity: 3, deadlineDays: 6, reward: 55 }],
    },
    choiceB: {
      label: 'Sell your spare sacks',
      summary: '+12🪙 now.',
      effects: [{ kind: 'coins_delta', amount: 12 }],
    },
  },
  {
    id: 'fair_committee',
    emoji: '🎪',
    title: 'The Fair Committee',
    body: 'The county fair opens soon and the committee wants crates of fresh radishes — fast, and they pay on delivery.',
    choiceA: {
      label: 'Take the contract',
      summary: 'Harvest 4 radishes within 5 days → +40🪙 on delivery.',
      effects: [{ kind: 'contract', cropId: 'radish', quantity: 4, deadlineDays: 5, reward: 40 }],
    },
    choiceB: {
      label: 'Sell what you have',
      summary: '+10🪙 now.',
      effects: [{ kind: 'coins_delta', amount: 10 }],
    },
  },
  {
    id: 'wandering_beekeeper',
    emoji: '🐝',
    title: 'The Wandering Beekeeper',
    body: 'A beekeeper offers to park her hives beside your fields for a few days. Pollinated crops sell plumper — for a small fee.',
    choiceA: {
      label: 'Pay 15🪙',
      summary: 'Next 4 harvests +20% coins.',
      effects: [
        { kind: 'coins_delta', amount: -15 },
        { kind: 'yield_buff', multiplier: 1.2, harvests: 4, exhaustionFactor: 1 },
      ],
    },
    choiceB: { label: 'Decline', summary: 'Save your coins.', effects: [] },
  },
];
