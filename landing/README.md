# landing

Публичный маркетинговый сайт SmartQoldau (эпик E10) — Next.js (App Router,
TypeScript), Tailwind CSS, локализация `next-intl` (`/ru/*`, `/kz/*`),
Jest + React Testing Library.

Независим от Flutter-пакетов (`app_client`, `app_expert`,
`packages/shared`) — обычное Node/Next.js-приложение со своим
`package-lock.json` (тот же паттерн, что `backend/`; в этом монорепо npm
workspaces не используются).

## Запуск

```bash
npm install
npm run dev            # http://localhost:3000 — конфликтует с backend/, см. ниже
npm run dev -- -p 3100 # если backend уже поднят на :3000
```

Витрина специалистов на главной (`GET /experts`) и форма поддержки
(`POST /tickets`) обращаются к живому бэкенду — по умолчанию
`http://localhost:3000/v1` (переопределяется `NEXT_PUBLIC_API_BASE_URL`).
Без поднятого бэкенда витрина специалистов просто показывает пустое
состояние, форма поддержки — ошибку сети при отправке.

## Тесты и сборка

```bash
npm run lint
npm test
npm run build
```

## Структура

```
app/
  layout.tsx              — пробрасывает children; редирект "/" -> "/ru"
                             делает middleware.ts (next-intl), НЕ этот layout
  sitemap.ts, robots.ts
  [locale]/                — все страницы под локалью ru|kz, html/body здесь
middleware.ts               — next-intl, локаль по пути
components/                — Header, Footer, SpecialistCard, FaqAccordion,
                              SupportForm, LegalPageLayout
lib/
  api.ts                   — fetchPublicExperts, submitTicket
  ticket.ts                — buildTicketPayload (чистая функция)
  i18n/                    — routing.ts, request.ts, navigation.ts (next-intl;
                              Link/redirect/useRouter — из createNavigation,
                              next-intl v4 не экспортирует их из корня пакета)
messages/                  — ru.json, kz.json
```

Полный план разработки: `../brain/WIKI/plans/2026-08-25-план-E10-лендинг-и-юрстраницы.md`.

## Известные ограничения

- Ссылки на несуществующий пока веб-каталог/подбор темы/материалы ведут на
  `/support` — решение задокументировано в плане (раздел «Решения»).
- Цена Premium — 2 990 ₸/мес / 23 900 ₸/год (решение Р-08), не совпадает с
  устаревшей ценой в исходном прототипе (4 990 ₸/мес).

## Ручная проверка против живого бэкенда (пройдена)

Все 6 страниц на обеих локалях отдают 200, витрина специалистов на
главной рендерит реального верифицированного эксперта из БД
(`GET /experts`), форма поддержки успешно создаёт тикет
(`POST /tickets` → `201`, проверено прямым запросом с телом, которое
собирает `buildTicketPayload`). Найден и исправлен реальный баг при
проверке: корневой `app/layout.tsx` безусловно вызывал
`redirect('/ru')`, что применялось абсолютно ко всем маршрутам (включая
уже `/ru`) — Next.js рендерит корневой layout как предка каждого
дочернего маршрута — и приводило к самозацикленному редиректу `/ru` →
`/ru`. Исправлено: редирект "/" -> "/ru" отдан целиком middleware.ts
(next-intl, `localePrefix: "always"` по умолчанию уже это делает),
`app/layout.tsx` теперь просто пробрасывает `children`.
