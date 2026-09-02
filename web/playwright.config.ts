import { defineConfig } from '@playwright/test';

// Порт 3100, а не 3000: на 3000 живёт бэкенд (см. README).
const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Стенд отдаёт API через прокси на 8080. Переопределяется переменной
// окружения, чтобы те же тесты можно было направить на другой стенд.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/v1';

export default defineConfig({
  testDir: './e2e',
  // Сборка, а не dev-сервер: проверяется то, что поедет в прод, включая
  // серверный рендер и кэширование. Dev-сервер ведёт себя иначе и
  // зелёный в нём ничего не доказывает.
  webServer: {
    // Именно standalone-сборка: она и едет в контейнере (см. Dockerfile).
    // `next start` со standalone не работает и проверял бы другой режим.
    command: `npm run build && PORT=${PORT} npm run start:standalone`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: { NEXT_PUBLIC_API_BASE_URL: API_BASE_URL },
  },
  use: { baseURL: BASE_URL },
  reporter: process.env.CI ? 'github' : 'list',
});
