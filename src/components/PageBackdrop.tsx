import type { CSSProperties } from 'react';
import { getDecorUrl } from './decorAssets';

/**
 * 018 — full-page illustrated backdrop. A fixed layer behind all content
 * (-z-10 keeps it under every non-positioned sibling), purely decorative:
 * aria-hidden + pointer-events-none so it never intercepts a tap or enters
 * the accessibility tree. Every asset is optional — a missing soil tile
 * leaves the flat page colour, a missing prop simply doesn't render.
 */

interface PropSpec {
  name: string;
  /** Rendered height in px (2× the source art keeps pixels crisp). */
  height: number;
  style: CSSProperties;
  /** Hide below md, where content fills the viewport width. */
  desktopOnly?: boolean;
}

/**
 * Asymmetric composition: small vegetation scattered across the side margins
 * (opened up by the board's max-width) and the area below the fold, with a
 * couple of stones for texture. Positions are hand-tuned to read as a random
 * scatter while staying stable across reloads and clear of the central
 * content column. Margin/upper props are desktopOnly so the mobile layout —
 * where content fills the width — stays clean; only the bottom-edge props
 * show on every size. Tuned visually — adjust freely in the browser preview.
 */
const PROPS: PropSpec[] = [
  // Stones — texture accents in the exposed soil band.
  { name: 'stones',    height: 56,  style: { top: '67%', left: '36%' },    desktopOnly: true },
  { name: 'stones',    height: 48,  style: { bottom: 22, left: '60%' } },

  // Grass & flowers — ~10 patches scattered across the exposed soil below the
  // board, kept left of the desktop shop sidebar so they actually read.
  { name: 'grass_2',   height: 72,  style: { top: '63%', left: 6 } },
  { name: 'flower_1',  height: 64,  style: { top: '69%', left: '17%' } },
  { name: 'grass_1',   height: 72,  style: { top: '73%', left: '30%' },    desktopOnly: true },
  { name: 'grass_2',   height: 80,  style: { top: '64%', left: '45%' },    desktopOnly: true },
  { name: 'flower_1',  height: 64,  style: { top: '71%', left: '58%' },    desktopOnly: true },
  { name: 'grass_1',   height: 88,  style: { bottom: '22%', left: 22 } },
  { name: 'grass_2',   height: 64,  style: { bottom: 10, left: '24%' } },
  { name: 'flower_1',  height: 80,  style: { bottom: 18, left: '40%' } },
  { name: 'grass_1',   height: 64,  style: { bottom: 8,  left: '53%' },    desktopOnly: true },
  { name: 'grass_2',   height: 72,  style: { bottom: 26, left: 40 } },
];

export function PageBackdrop() {
  const soilUrl = getDecorUrl('soil_tile');

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none bg-farm-page"
      style={
        soilUrl
          ? {
              backgroundImage: `url(${soilUrl})`,
              backgroundRepeat: 'repeat',
              backgroundSize: '256px 256px',
              imageRendering: 'pixelated',
            }
          : undefined
      }
    >
      {PROPS.map((prop, i) => {
        const url = getDecorUrl(prop.name);
        if (!url) return null;
        return (
          <img
            key={`${prop.name}-${i}`}
            src={url}
            alt=""
            draggable={false}
            className={
              prop.desktopOnly ? 'hidden md:block absolute' : 'absolute'
            }
            style={{
              ...prop.style,
              height: prop.height,
              width: 'auto',
              imageRendering: 'pixelated',
            }}
          />
        );
      })}
    </div>
  );
}
