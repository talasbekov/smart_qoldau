/// Аналитика приложения (ТЗ §10).
///
/// Задача 2 (E7): сам провайдер и реализации ([NoopAnalytics],
/// [PostHogAnalytics]) переехали в `shared` без изменений — здесь ничего
/// app_client-специфичного не было (только `dio` и типы `shared`). Этот
/// файл остаётся тонким реэкспортом, чтобы не трогать импорты во всех
/// местах, где `analyticsProvider` уже используется.
library;

export 'package:shared/shared.dart' show analyticsProvider;
