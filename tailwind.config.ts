import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        farm: {
          soil:      '#4A2F1A',
          grass:     '#3D7A2B',
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
    },
  },
  plugins: [],
} satisfies Config;
