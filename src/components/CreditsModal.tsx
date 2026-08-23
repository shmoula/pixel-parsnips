import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const LPC_URL = 'https://opengameart.org/content/lpc-crops';

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="font-pixel text-caption text-farm-stone uppercase tracking-widest">{heading}</h3>
      <p className="font-pixel text-caption text-farm-parchment leading-relaxed">{children}</p>
    </section>
  );
}

/**
 * 024 — asset attribution.
 *
 * The crop sprites derive from "[LPC] Crops", licensed CC-BY-SA 3.0+, which requires
 * naming the original authors and linking back to the source. The link is a real
 * anchor rather than plain text: a non-clickable URL is a weaker discharge of that
 * requirement. The full upstream record stays in src/assets/crops/CREDITS-crops.txt;
 * this is its human-readable summary.
 */
export function CreditsModal({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Portalled to <body>: rendered from GameMenu, this modal sits inside the HUD
  // header, whose backdrop-blur makes it the containing block for `position:
  // fixed`. Without the portal, `fixed inset-0` would resolve to the 64px header
  // box rather than the viewport, centring the dialog on the header and clipping
  // its top. The portal lifts it out so it centres on the viewport.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Credits"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-6"
    >
      <div className="max-w-sm w-full max-h-[80vh] overflow-y-auto bg-farm-soil border-2 border-farm-stone/40 rounded-lg p-5 flex flex-col gap-4">
        <h2 className="font-pixel text-title text-farm-gold">Credits</h2>

        <Section heading="Crop sprites">
          &quot;[LPC] Crops&quot; by bluecarrot16, Daniel Eddeland, Joshua Taylor and
          Richard Kettering. Commissioned by castelonia. Licensed CC-BY-SA 3.0+ / GPL-3.0+.{' '}
          <a
            href={LPC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-farm-gold underline break-all"
          >
            opengameart.org/content/lpc-crops
          </a>
        </Section>

        <Section heading="Backdrop, props and shop texture">
          Original work by Vaclav Balak.
        </Section>

        <Section heading="Font">
          Press Start 2P by CodeMan38, SIL Open Font License 1.1.
        </Section>

        <Section heading="Sound">
          Synthesised in-browser; no sampled audio.
        </Section>

        <p className="font-pixel text-caption text-farm-stone leading-relaxed">
          Game code © 2026 Vaclav Balak, MIT licensed.
        </p>

        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="
            font-pixel text-body px-4 py-2 min-h-[44px] rounded self-center
            bg-farm-grass text-farm-parchment
            hover:bg-farm-gold hover:text-farm-ink transition-colors
          "
        >
          Close
        </button>
      </div>
    </div>,
    document.body,
  );
}
