# app_client

Клиентское Flutter-приложение SmartQoldau (эпик E6). Использует общий пакет
[`packages/shared`](../packages/shared) — API-клиент, модели и дизайн-система
монорепо, наполняемые последующими задачами эпика.

## Окружение

Проверено и зафиксировано 2026-08-22 на Ubuntu 24.04.4 LTS:

```
$ flutter --version
Flutter 3.47.1 • channel stable • https://github.com/flutter/flutter.git
Framework • revision 6655482ec0 (2026-08-19)
Engine • hash 11d79658c444477b06513d32b52c8c4ccb7276b0 (revision 5d53178869)
Tools • Dart 3.13.1 • DevTools 2.60.0
```

`flutter doctor`:

```
[✓] Flutter (Channel stable, 3.47.1, on Ubuntu 24.04.4 LTS 7.0.0-29-generic, locale ru_RU.UTF-8)
[✗] Android toolchain - develop for Android devices (Android SDK не установлен)
[✓] Chrome - develop for the web
[✗] Linux toolchain - develop for Linux desktop (нет clang/cmake/ninja/GTK)
[✓] Connected device (2 available)
[✓] Network resources
```

**Сборка под Android и iOS сейчас недоступна** — нужен Android SDK
(`flutter config --android-sdk` после установки Android Studio) и, для iOS,
macOS с Xcode. Linux desktop-таргет не входит в объём MVP.
**`flutter test` и `flutter analyze` работают headless** и не требуют
устройства или установленного тулчейна — ими и проверяется код в CI и
локально. Единственное доступное сейчас устройство для `flutter run` —
Chrome (`flutter run -d chrome`).

## Структура монорепо

```
app_client/          — приложение (этот пакет)
packages/shared/      — общий пакет: API-клиент, модели, дизайн-система
```

`app_client` подключает `shared` как path-зависимость
(`shared: {path: ../packages/shared}` в `pubspec.yaml`).

## Запуск

Требуется поднятый бэкенд (см. [`backend/README.md`](../backend/README.md) и
[`infra/docker-compose.dev.yml`](../infra/docker-compose.dev.yml)):

```bash
docker compose -f infra/docker-compose.dev.yml up -d
cd backend && npm run start:dev   # слушает http://localhost:3000, префикс /v1
```

Установка зависимостей (оба пакета монорепо):

```bash
cd packages/shared && flutter pub get
cd ../../app_client && flutter pub get
```

Запуск приложения (Chrome — сейчас единственное доступное устройство) с
адресом бэкенда через `--dart-define`:

```bash
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:3000/v1
```

`API_BASE_URL` — конвенция для конфигурации адреса бэкенда без пересборки
кода (см. также `LEGAL_BASE_URL` в задаче 6 эпика E6); сам API-клиент,
который будет читать это значение, появится в задаче 4.

## Тесты и анализ

```bash
flutter test      # из app_client/ и из packages/shared/
flutter analyze   # 0 issues
```
