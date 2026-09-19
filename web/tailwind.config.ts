import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      spacing: { 13: '3.25rem' },
      fontFamily: { sans: ['Inter', 'sans-serif'] },
      // Оттенки вторичного текста затемнены до WCAG AA (4.5:1) на всех
      // трёх подложках — белой, surface и chip. Порядок светлоты
      // сохранён: faint светлее muted, muted светлее body, — иначе
      // схлопывается смысловая иерархия текста.
      colors: {
        primary: '#0f766e',
        'primary-dark': '#0a5951',
        ink: '#0f3f3a',
        'ink-soft': '#3f5450',
        body: '#445b57',
        muted: '#516561',
        faint: '#5a716c',
        border: '#eef2f0',
        surface: '#f7faf9',
        chip: '#e3f3ee',
      },
    },
  },
  plugins: [],
};
export default config;
