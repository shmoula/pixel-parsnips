import type { Config } from 'tailwindcss';
import { PALETTE } from './src/theme/palette';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        farm: {
          soil: PALETTE.soil,
          grass: PALETTE.grass,
          sky: PALETTE.sky,
          gold: PALETTE.gold,
          red: PALETTE.red,
          stone: PALETTE.stone,
          parchment: PALETTE.parchment,
          ink: PALETTE.ink,
          bar: PALETTE.bar,
          chip: PALETTE.chip,
          chipBorder: PALETTE.chipBorder,
          chipHover: PALETTE.chipHover,
          page: PALETTE.page,
          danger: PALETTE.danger,
          field: PALETTE.field,
          plot: PALETTE.plot,
          plotGrowing: PALETTE.plotGrowing,
          plotReady: PALETTE.plotReady,
          plotPest: PALETTE.plotPest,
          plotBorder: PALETTE.plotBorder,
          plotLockedLabel: PALETTE.plotLockedLabel,
          redHover: PALETTE.redHover,
          disasterGround: PALETTE.disasterGround,
        },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
      },
      // Semantic type scale — three roles only. Press Start 2P has a single
      // weight, so hierarchy leans on size + colour + caps. Prefer these over
      // ad-hoc text-[Npx] / text-xs / text-sm so the scale lives in one place.
      //   caption → secondary meta: dim labels, captions, small chrome buttons
      //   body    → primary default: names, buttons, most copy (matches old text-xs)
      //   title   → headings + hero values: modal titles, HUD values
      fontSize: {
        caption: ['0.625rem', { lineHeight: '0.875rem' }], // 10px / 14px
        body: ['0.75rem', { lineHeight: '1rem' }], //        12px / 16px
        title: ['1.125rem', { lineHeight: '1.5rem' }], //    18px / 24px
      },
    },
  },
  plugins: [],
} satisfies Config;
