# app_expert

Flutter-приложение эксперта SmartQoldau (эпик E7). Использует общий пакет
[`packages/shared`](../packages/shared) — тот же API-клиент, модели и
дизайн-система, что и [`app_client`](../app_client). `packages/shared`
также несёт роль-независимую бизнес-логику сессии консультации,
перенесённую из `app_client` задачей 2: `CallController`/`CallEngine`,
весь пуш-канал (`PushBootstrap`, `PushMessagingPort`, `FirebasePushMessagingPort`),
чат/звонок разрешения (`PermissionService`). Чат — **исключение**:
`ChatController` из `shared` завязан на `ClientConsultation` (клиентскую
форму DTO) и не переиспользуется — `app_expert` ведёт свою сессию чата
поверх тех же примитивов шины (`ExpertSessionController`, задача 13; см.
докстринг файла для полного обоснования).

**У эксперта нет гостевого режима**: анкета онбординга требует полноценной
регистрации по телефону — `AuthController` этого приложения не имеет
варианта `AuthGuest`/метода `continueAsGuest()`, в отличие от `app_client`.

## Окружение

```
$ flutter --version
Flutter 3.47.1 • channel stable • https://github.com/flutter/flutter.git
Framework • revision 6655482ec0 (2026-08-19)
Engine • hash 11d79658c444477b06513d32b52c8c4ccb7276b0 (revision 5d53178869)
Tools • Dart 3.13.1 • DevTools 2.60.0
```

`flutter test` и `dart analyze` работают headless и не требуют устройства —
ими проверяется код в CI и локально.

**Известное ограничение локального окружения:** `flutter analyze` (в
отличие от `dart analyze`) падает в analysis server'e с
`FormatException: Unexpected end of input` из-за кириллицы в пути репозитория
(`.../Музыка/smart_qoldau/...`) — воспроизводится так же и в `app_client`,
не специфично для этого приложения. CI (`ubuntu-latest`, путь без кириллицы)
не подвержен этой проблеме — `flutter analyze` там штатно используется.

**Долг: JDK не установлен в окружении** — `flutter build apk`/эмулятор
недоступны, ручная проверка на устройстве не выполнена для задач 6, 8, 11,
13 (задокументировано в отчётах каждой задачи). Юнит- и виджет-тесты этим
не затронуты — они работают headless.

**Долг: локализация не заведена.** Все экраны — хардкод русского текста;
`l10n/app_ru.arb`/`app_kk.arb` и переключение на `AppLocalizations`
запланированы отдельной финальной задачей эпика (полный ретрофит текста
~20 экранов + `arb_parity_test.dart` — сознательно отложено на конец, а
не размазано по задачам, чтобы не тормозить каждую отдельную задачу
переводом строк, которые могут ещё поменяться). `LocaleController`
(`core/locale_controller.dart`) уже хранит и синхронизирует ВЫБОР языка
с бэкендом (`PATCH /me/locale`, влияет на язык push-уведомлений) — не
дожидается локализации UI.

## Структура

```
lib/
  main.dart                       — точка входа, сборка ProviderContainer
  app.dart                        — SqExpertApp, корневой MaterialApp.router
  router.dart                     — go_router + редирект-гард сессии
  core/
    providers.dart                — SqApi/SqEvents, TokenStore, appNavigatorKeyProvider
    locale_controller.dart        — выбор языка интерфейса + синхронизация
    push_token_source.dart, push/fcm_push_token_source.dart
    incoming_offer_alert_port.dart — showDialog-порт полноэкранного алерта оффера
    route_paths.dart, token_store.dart
  features/
    auth/            — вход по телефону (SMS/JWT), без гостя
    onboarding/       — анкета специалиста в 2 шага
    verification/     — документы, фото, статус верификации
    schedule/          — еженедельное расписание + исключения
    home/              — главный экран: статус приёма, presence-heartbeat
    offers/            — полноэкранный алерт + список офферов (accept/decline)
    consultations/     — заявки/консультации (3 раздела), исход, заметки
    session/            — чат и звонок консультации (ExpertSessionController)
    earnings/           — доход, баланс, вывод средств
    reviews/            — лента отзывов о себе (без ответа/жалобы — см. ниже)
    notifications/      — центр уведомлений, регистрация устройства
    profile/             — имя, язык, выход
```

## Известные ограничения бэкенд-контракта

- **Ответ/жалоба на отзыв не реализованы** (задача 15): публичный
  `GET /experts/{id}/reviews` полностью анонимизирован и не несёт
  `review.id` — без него `POST /reviews/{id}/reply`/`/complaint`
  вызвать нечем. Нужен бэкенд-эндпоинт `GET /experts/me/reviews` с id
  в ответе — заведено в Plane (проект Smart Qoldau, Backlog).
- **Killed-state push** (алерт оффера, когда приложение выгружено ОС)
  недостижим без CallKit/PushKit/VoIP-токена на бэкенде — вне объёма
  эпика, см. Global Constraints плана.

## Запуск

```
flutter pub get
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:3000/v1
```

## Тесты

```
flutter test
dart analyze
```
