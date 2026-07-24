import type { FarmEventChoiceId } from '../engine/types';
import { choiceBuyIn } from '../engine/farmEvents';
import type { PendingFarmEventView } from '../engine/useGameEngine';
import { EmojiIcon } from './EmojiIcon';

/** Total up-front cost of a choice: the sum of its negative coins_delta amounts, as a positive number. */
export const choiceCost = choiceBuyIn;

interface FarmEventModalProps {
  view: PendingFarmEventView;
  /** True during the player's second run — the feature just unlocked. */
  isNew: boolean;
  onChoose: (choice: FarmEventChoiceId) => void;
}

/**
 * 022 — the Farm Event choice modal. Deliberately unclosable (no Escape, no
 * backdrop dismiss): the run pauses until the player picks a side. Reloading
 * re-presents it (pending persists in the save).
 */
export function FarmEventModal({ view, isNew, onChoose }: FarmEventModalProps) {
  const { def, offerValue, balance } = view;
  const costA = choiceCost(def.choiceA.effects);
  const affordableA = balance >= costA;
  const summaryA = def.id === 'traveling_merchant'
    ? `All growing crops sold instantly — est. +${offerValue}🪙.`
    : def.choiceA.summary;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={def.title}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-6"
    >
      <div className="max-w-sm w-full bg-farm-soil border-2 border-farm-stone/40 rounded-lg p-5 flex flex-col gap-4">
        <h2 className="font-pixel text-title text-farm-gold flex items-center gap-2">
          <EmojiIcon>{def.emoji}</EmojiIcon>
          <span>{def.title}</span>
          {isNew && (
            <span className="ml-auto font-pixel text-caption text-farm-ink bg-farm-gold px-2 py-0.5 rounded uppercase tracking-widest">
              New!
            </span>
          )}
        </h2>
        <p className="font-pixel text-body text-farm-parchment leading-relaxed">{def.body}</p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            autoFocus
            disabled={!affordableA}
            onClick={() => onChoose('A')}
            className="font-pixel text-body text-left px-4 py-3 min-h-[44px] rounded bg-farm-grass text-farm-parchment hover:enabled:bg-farm-gold hover:enabled:text-farm-ink disabled:opacity-40 transition-colors"
          >
            <span className="block">{def.choiceA.label}</span>
            <span className="block text-caption text-farm-parchment/80 mt-1">
              {affordableA ? summaryA : `Not enough coins (needs ${costA}🪙).`}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onChoose('B')}
            className="font-pixel text-body text-left px-4 py-3 min-h-[44px] rounded bg-farm-ink text-farm-parchment border border-farm-stone/40 hover:bg-[#3A2510] transition-colors"
          >
            <span className="block">{def.choiceB.label}</span>
            <span className="block text-caption text-farm-parchment/80 mt-1">{def.choiceB.summary}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
