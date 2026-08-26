import type { Config } from 'tailwindcss';

// Палитра — из дизайн-системы продукта (`packages/shared/lib/design/
// tokens.dart`), той же, на которой построен прототип: при разборе
// Expert Web цвета совпали до символа. У админки собственного прототипа
// нет ни одного экрана, поэтому единственный честный эталон для неё —
// токены, а не выдуманная вёрстка.
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sq: {
          primary: '#0F766E',
          'primary-dark': '#0F3F3A',
          accent: '#159A7C',
          danger: '#C0392B',
          background: '#FAFCFB',
          surface: '#FFFFFF',
          'surface-muted': '#EDF2F0',
          chip: '#E3F3EE',
          border: '#C7D3CF',
          text: '#0F3F3A',
          'text-secondary': '#6B8580',
          'text-tertiary': '#8FA6A1',
        },
      },
      borderRadius: {
        sq: '12px',
      },
    },
  },
  plugins: [],
};
export default config;
