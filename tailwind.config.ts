import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        farm: {
          soil:      '#4A2F1A',
          grass:     '#357028',
          sky:       '#6BBFFF',
          gold:      '#F5C842',
          red:       '#C0392B',
          stone:     '#8C7B6B',
          parchment: '#F5ECD7',
          ink:       '#1A1A1A',
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
