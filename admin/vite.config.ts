import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'node:path';

// https://vite.dev/config/
// База задаётся при сборке: на тестовом стенде админка живёт под /admin/,
// потому что корень занят веб-приложением продукта. По умолчанию корень —
// в бою админка стоит на своём поддомене.
const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
});
