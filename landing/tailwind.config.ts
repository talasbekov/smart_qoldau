import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'sans-serif'] },
      colors: {
        primary: '#0f766e',
        'primary-dark': '#0a5951',
        ink: '#0f3f3a',
        'ink-soft': '#3f5450',
        body: '#5b7a75',
        muted: '#6b8580',
        faint: '#8fa6a1',
        border: '#eef2f0',
        surface: '#f7faf9',
        chip: '#e3f3ee',
      },
    },
  },
  plugins: [],
};
export default config;
