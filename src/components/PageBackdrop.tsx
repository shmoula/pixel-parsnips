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
 * Asymmetric composition: hero tools anchored to the page edges (visible in
 * the side margins opened up by the board's max-width), small vegetation
 * scattered along edges and the area below the fold. Tuned visually — adjust
 * freely in the browser preview.
 */
const PROPS: PropSpec[] = [
  { name: 'rake',      height: 320, style: { top: '10%', left: 8 },        desktopOnly: true },
  { name: 'pitchfork', height: 320, style: { bottom: '6%', right: 12 },    desktopOnly: true },
  { name: 'grass_2',   height: 96,  style: { top: '40%', right: 28 },      desktopOnly: true },
  { name: 'flower_1',  height: 96,  style: { bottom: '12%', left: 48 },    desktopOnly: true },
  { name: 'stones',    height: 64,  style: { top: '32%', left: 52 },       desktopOnly: true },
  { name: 'grass_1',   height: 96,  style: { top: '70%', left: 8 } },
  { name: 'grass_1',   height: 64,  style: { bottom: 8, right: '30%' } },
  { name: 'stones',    height: 48,  style: { bottom: 28, left: '42%' } },
];

export function PageBackdrop() {
  const soilUrl = getDecorUrl('soil_tile');

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none bg-[#140E06]"
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
