# app_expert

Flutter-приложение эксперта SmartQoldau (эпик E7). Использует общий пакет
[`packages/shared`](../packages/shared) — тот же API-клиент, модели и
дизайн-система, что и [`app_client`](../app_client).

**У эксперта нет гостевого режима**: анкета онбординга (следующие задачи
эпика E7) требует полноценной регистрации по телефону, поэтому
`AuthController` этого приложения не имеет варианта `AuthGuest`/метода
`continueAsGuest()` — в отличие от `app_client`.

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

## Структура

```
lib/
  main.dart                    — точка входа
  app.dart                     — SqExpertApp, корневой MaterialApp.router
  router.dart                  — go_router + редирект-гард сессии
  core/
    providers.dart             — SqApi, TokenStore, SecureStore
    route_paths.dart           — пути маршрутов
    token_store.dart           — секьюрное хранилище токенов/профиля
  features/
    auth/
      data/auth_repository.dart
      state/auth_controller.dart
      ui/{splash_screen,phone_screen,code_screen}.dart
    shell/
      ui/app_shell.dart        — заглушка кабинета авторизованного эксперта
```

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
