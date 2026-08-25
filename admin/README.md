# admin

Внутренняя панель сотрудников SmartQoldau (эпик E8) — React SPA (Vite,
TypeScript), `react-router-dom`, Tailwind CSS, Vitest + React Testing
Library.

Независим от других пакетов монорепо (`backend/`, `app_client/`,
`app_expert/`, `packages/shared/`, `landing/`) — обычное Vite-приложение
со своим `package-lock.json`.

## Запуск

```bash
npm install
npm run dev   # http://localhost:5173
```

Требует живой бэкенд с включённым CORS (`backend/src/bootstrap.ts`,
`app.enableCors()` — добавлено этим же эпиком) на
`http://localhost:3000/v1` по умолчанию (переопределяется
`VITE_API_BASE_URL`). CORS — allow-list (`ADMIN_ORIGINS`, через запятую)
на бэкенде, по умолчанию только `http://localhost:5173`; если Vite
занял другой порт (порт уже был занят), добавить его в
`ADMIN_ORIGINS`, например: `ADMIN_ORIGINS="http://localhost:5173,http://localhost:5174" npm run start:dev`.

## Тесты и сборка

```bash
npm run lint
npm test
npm run build
```

## Структура

```
src/
  lib/           — apiFetch (обёртка с Authorization/401-refresh), tokenStore,
                   auth (login/totpVerify), settings/staff/verification/
                   profileModeration/flaggedExperts/reviewsModeration/payouts/
                   tickets — по одному файлу на модуль бэкенда admin/*
  routes/        — LoginPage, TotpChallengePage, AppLayout (сайдбар с
                   ролевой навигацией), SettingsPage, StaffPage,
                   VerificationQueuePage, ProfileModerationPage,
                   FlaggedExpertsPage, ReviewsModerationPage, PayoutsPage,
                   TicketsPage, TicketDetailPage
  components/    — QueueTable (общая таблица), DecisionModal (общая
                   approve/reject модалка), RoleGate (скрывает UI по ролям)
```

Полный план разработки: `../brain/WIKI/plans/2026-08-25-план-E8-админ-панель.md`.

## Роли (RBAC)

`VERIFICATION_OPERATOR`, `SUPPORT_OPERATOR`, `QUALITY_TEAM`,
`FINANCE_CONTROL`, `SUPERADMIN` (последняя проходит любую проверку роли).
Видимость пунктов меню — подсказка UX, реальный контроль доступа — на
бэкенде (`403 ADMIN_FORBIDDEN`).

## Первый сотрудник (SUPERADMIN)

`POST /admin/staff` сам требует токен SUPERADMIN — курица и яйцо для
самого первого сотрудника. Используется
`backend/src/cli/seed-superadmin.ts` (`npm run admin:seed -- --email=...
--password=...` в `backend/`) — создаёт (или чинит доступ
существующему) сотрудника с ролью SUPERADMIN напрямую в БД, минуя HTTP.

## SLA очереди верификации

ТЗ §11.4 обещает эксперту решение по анкете за 24 часа. Система срок не
форсит (таймера/автоэскалации нет), но очередь показывает, сколько
каждая заявка уже ждёт, и подсвечивает просроченные красным
(`lib/sla.ts`, `VERIFICATION_SLA_HOURS = 24`). Точка отсчёта —
`submittedAt` из `GET /admin/verification/queue` (бэкендовое
`experts.verification_submitted_at`, ставится на `submit`, а не на
регистрации: после `REUPLOAD_REQUIRED` эксперт возвращается в DRAFT и
отправляет анкету заново — отсчёт начинается заново вместе с ним).
Бэкенд сортирует очередь по этому полю, поэтому дольше всех ждущие идут
сверху. `submittedAt: null` (записи, отправленные до появления поля)
показывается прочерком, а не «0 мин».

## Известные ограничения (вне объёма E8 — не подкреплено бэкендом)

- Дашборд метрик, блокировка клиентов, справочники (CRUD), ledger-вью и
  ручные корректировки финансов — на бэкенде нет соответствующих
  эндпоинтов на момент разработки, см. план (раздел «Вне объёма»).

## Ручная проверка против живого бэкенда (пройдена)

Поднят полный стек (`docker compose infra` + `backend` +
`admin` dev-сервер), заведён SUPERADMIN через `admin:seed`, вход
подтверждён (`POST /admin/auth/login` без 2FA — свежий аккаунт).
Проверены точные HTTP-вызовы, которые делают страницы (curl с тем же
методом/путём/телом, что и `lib/*.ts`): список и карточка тикетов,
ответ, закрытие (`GET/POST /admin/tickets*`), список сотрудников
(`GET /admin/staff`), очередь верификации (`GET
/admin/verification/queue`), выплаты (`GET /admin/payouts`), флаг
отзывов (`GET /admin/reviews/flagged`) — формы ответов совпадают с
TypeScript-интерфейсами `lib/*.ts` один в один. Оба dev-сервера
остановлены после проверки.
