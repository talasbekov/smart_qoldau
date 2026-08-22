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

Используем `dart analyze`, а не `flutter analyze` — репозиторий лежит по пути
с кириллицей, а `flutter analyze` падает на нём с `FormatException` в
LSP-канале `analysis_server` (подтверждённый дефект окружения, к коду
отношения не имеет).

**Симптом:** сразу после свежего `git clone` (или в CI) `flutter test` в
`app_client` шумно перерезолвит зависимости перед каждым прогоном —
печатает `Resolving dependencies... / Downloading packages... / Got
dependencies! / N packages have newer versions...` вместо того, чтобы сразу
перейти к тестам. **Причина:** эвристика `flutter_tools`, решающая, можно ли
пропустить `pub get`, сравнивает время модификации `pubspec.yaml` с
`pubspec.lock`/`.dart_tool/package_config.json` — а git не хранит mtime
файлов, поэтому на свежем клоне порядок временных меток случаен и заранее
не гарантирован. **Обход:** один раз выполнить `flutter pub get`, после
которого больше не редактировать `pubspec.yaml` вручную — тогда `pubspec.lock`
гарантированно окажется новее и последующие `flutter test` будут тихими; если
нужно — можно принудительно `touch pubspec.lock .dart_tool/package_config.json`.

## Проверка звонка на эмуляторе — заблокировано окружением

Задача 14 (аудио/видео на LiveKit) реализована и покрыта headless-тестами,
но Step 4 плана (прогон на эмуляторе с поднятым `livekit` из
`infra/docker-compose.dev.yml`) выполнить не удалось: в системе установлена
только JRE — `javac` нет нигде (`/usr/lib/jvm/java-21-openjdk-amd64` без
`JAVA_COMPILER`), и `flutter build apk --debug` падает на
`:app:compileDebugJavaWithJavac`:

```
Toolchain installation '/usr/lib/jvm/java-21-openjdk-amd64'
does not provide the required capabilities: [JAVA_COMPILER]
```

Чтобы разблокировать: `sudo apt install openjdk-21-jdk` (или указать путь
к JDK через `flutter config --jdk-dir=<path>`). После этого нужно провести
аудио- и видеозвонок, эскалацию чат → аудио → видео и проверку реконнекта
(`adb shell svc data disable` / `enable` на 10 с) и записать результат сюда.

## Пуш-уведомления (FCM/APNs)

Пуш-канал реализован полностью, но выключен по умолчанию: ключей Firebase и
сертификатов APNs в репозитории нет. При `PUSH_ENABLED=false` (значение по
умолчанию) приложение **не обращается к Firebase ни одним вызовом** — в
провайдере остаётся `NoopPushTokenSource`, устройство не регистрируется,
локальные уведомления не инициализируются.

Чтобы включить:

1. Создайте проект в консоли Firebase, добавьте приложения Android
   (`kz.smartqoldau.app_client`) и iOS (`kz.smartqoldau.appClient`).
2. Положите выданные файлы рядом с примерами:
   `android/app/google-services.json` и
   `ios/Runner/GoogleService-Info.plist` (оба в `.gitignore`).
3. Для iOS загрузите APNs-ключ (.p8) в настройки проекта Firebase.
4. Соберите с флагом:
   `flutter run --dart-define=PUSH_ENABLED=true`.

Gradle-плагин Google Services применяется условно — только если
`android/app/google-services.json` реально лежит на месте
(`app/build.gradle.kts`). Без файла сборка идёт как обычно: иначе плагин
валил бы её с «File google-services.json is missing» у всех, кто собирает
проект без Firebase.

**Не проверено сборкой (2026-08-23):** `flutter build apk --debug` в этом
окружении не запускается — установлена только JRE, `javac` отсутствует
(см. раздел про эмулятор ниже). Условное подключение плагина и конфигурации
написаны, но прогнать сборку с `.example`-конфигом было нечем.

Что делает клиент при включённом флаге: инициализирует Firebase, спрашивает
разрешение на уведомления, регистрирует токен через `POST /v1/devices`,
перерегистрирует его при перевыпуске, показывает локальное уведомление для
пуша в форграунде (не уводя человека с открытого экрана) и переходит по
дип-линку, когда пуш нажали — тем же разбором `type`/`data`, что и тайл
центра уведомлений.

## Диплинки

Схема ссылок и требования к лендингу — в `docs/deeplinks.md`. Приложение
разбирает `https://smartqoldau.kz/{e|t|c}/…` и `/sos`; всё остальное ведёт
на главную. Проверка на устройстве (`adb shell am start -a
android.intent.action.VIEW -d …`) в этом окружении не выполнялась — нет JDK
для сборки.

## Аналитика воронки (ТЗ §10)

По умолчанию выключена: `NoopAnalytics` не отправляет ничего, вызовы
трекинга на экранах остаются на местах. Включается флагами сборки:

```
flutter run \
  --dart-define=POSTHOG_HOST=https://posthog.example.kz \
  --dart-define=POSTHOG_KEY=phc_xxx
```

Список событий закрыт и повторяет ТЗ §10 (`packages/shared/lib/analytics`).
PII-инвариант: ни телефона, ни текста сообщений и отзывов, ни маски карты,
ни имени специалиста — проверяется табличным тестом по всем вариантам
событий. `distinct_id` — идентификатор пользователя из JWT (`sub`).
