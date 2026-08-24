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
 * Full-screen scatter: 12 grass/flower patches and 8 stones spread across the
 * whole viewport — every quadrant, including behind the board (they sit on a
 * -z-10 layer, so content simply occludes the ones it covers). Positions and
 * sizes are hand-tuned to read as a random scatter while staying stable across
 * reloads; each item is a distinct, larger size (~1.5–2× the previous pass).
 * Tuned visually — adjust freely in the browser preview.
 */
const PROPS: PropSpec[] = [
  // Grass & flowers (12), each a distinct size, scattered across the screen.
  { name: 'grass_2',   height: 152, style: { top: '5%',  left: '3%' } },
  { name: 'flower_1',  height: 116, style: { top: '9%',  left: '38%' } },
  { name: 'grass_1',   height: 168, style: { top: '7%',  right: '12%' } },
  { name: 'grass_2',   height: 128, style: { top: '21%', left: '12%' } },
  { name: 'flower_1',  height: 144, style: { top: '26%', right: '6%' } },
  { name: 'grass_1',   height: 112, style: { top: '33%', left: '30%' } },
  { name: 'grass_2',   height: 160, style: { top: '44%', right: '20%' } },
  { name: 'flower_1',  height: 124, style: { top: '51%', left: '7%' } },
  { name: 'grass_1',   height: 140, style: { top: '62%', right: '9%' } },
  { name: 'grass_2',   height: 120, style: { top: '68%', left: '22%' } },
  { name: 'flower_1',  height: 156, style: { bottom: '8%',  left: '44%' } },
  { name: 'grass_1',   height: 132, style: { bottom: '12%', right: '34%' } },

  // Stones (8), texture accents woven through the scatter.
  { name: 'stones',    height: 100, style: { top: '15%', left: '55%' } },
  { name: 'stones',    height: 84,  style: { top: '30%', right: '34%' } },
  { name: 'stones',    height: 120, style: { top: '40%', left: '18%' } },
  { name: 'stones',    height: 92,  style: { top: '57%', right: '40%' } },
  { name: 'stones',    height: 108, style: { top: '73%', left: '40%' } },
  { name: 'stones',    height: 80,  style: { top: '85%', right: '22%' } },
  { name: 'stones',    height: 116, style: { top: '12%', left: '82%' } },
  { name: 'stones',    height: 96,  style: { bottom: '16%', left: '12%' } },
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
