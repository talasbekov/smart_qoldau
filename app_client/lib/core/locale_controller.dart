/// Управление активной локалью интерфейса приложения.
///
/// Хранит текущую [Locale] в Riverpod-состоянии, персистит выбор
/// пользователя в [SharedPreferences] и, лучшим усилием, сообщает бэкенду
/// о смене языка через [LocaleSyncPort].
library;

import 'dart:ui' show Locale, PlatformDispatcher;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import 'package:shared_preferences/shared_preferences.dart';


/// Ключ, под которым выбранная локаль хранится в [SharedPreferences].
const _localePrefsKey = 'sq.locale';

/// Провайдер [SharedPreferences]. Инстанс асинхронный (`getInstance()`),
/// поэтому его прогревают один раз в `main()` до `runApp` и передают сюда
/// через `overrideWithValue` — без этого чтение провайдера бросает
/// [UnimplementedError].
final sharedPreferencesProvider = Provider<SharedPreferences>((ref) {
  throw UnimplementedError(
    'sharedPreferencesProvider должен быть переопределён в main() '
    'реальным SharedPreferences.getInstance()',
  );
});

/// Системная локаль устройства, вынесенная в провайдер, чтобы тесты могли
/// подменить её без обращения к реальной платформе.
final systemLocaleProvider = Provider<Locale>(
  (ref) => PlatformDispatcher.instance.locale,
);

/// Узкий порт синхронизации локали с бэкендом (`PATCH /v1/me/locale`).
///
/// `app_client` пока не умеет ходить в сеть — `SqApi` появится только в
/// задаче 4 эпика E6, а выбор языка интерфейса не должен от неё зависеть.
/// Реальную реализацию поверх `SqApi` подключит задача 19.
abstract class LocaleSyncPort {
  Future<void> pushLocale(String apiLocale);
}

/// Реализация [LocaleSyncPort] по умолчанию — ничего не делает.
class NoopLocaleSync implements LocaleSyncPort {
  const NoopLocaleSync();

  @override
  Future<void> pushLocale(String apiLocale) async {}
}

/// Реализация [LocaleSyncPort] поверх `SqApi` (`PATCH /v1/me/locale`).
///
/// Живёт здесь, а не в `features`: провайдер порта объявлен в `core`, и
/// заводить ради одной строки обратную зависимость `core -> features` было
/// бы хуже. Сам вызов — тонкий проброс.
class SqApiLocaleSync implements LocaleSyncPort {
  const SqApiLocaleSync(this._api);

  final SqApi _api;

  @override
  Future<void> pushLocale(String apiLocale) => _api.updateLocale(apiLocale);
}

/// Провайдер порта синхронизации локали. С задачи 19 — настоящий: язык
/// уведомлений хранится на бэкенде.
final localeSyncPortProvider = Provider<LocaleSyncPort>(
  (ref) => SqApiLocaleSync(ref.watch(sqApiProvider)),
);

final localeControllerProvider = NotifierProvider<LocaleController, Locale>(
  LocaleController.new,
);

/// Локаль интерфейса приложения.
///
/// Стартует с локали, сохранённой пользователем ранее; при её отсутствии —
/// с системной (`kk` → казахский, всё остальное → русский).
class LocaleController extends Notifier<Locale> {
  @override
  Locale build() {
    final prefs = ref.watch(sharedPreferencesProvider);
    final saved = prefs.getString(_localePrefsKey);
    if (saved != null) {
      return _narrowToSupported(saved);
    }

    final system = ref.watch(systemLocaleProvider);
    return _narrowToSupported(system.languageCode);
  }

  /// Сужает произвольный код языка до одной из двух реально поддерживаемых
  /// локалей приложения. Применяется как к сохранённому в
  /// [SharedPreferences] значению, так и к системной локали — источник
  /// значения не должен решать, попадёт ли в [MaterialApp.locale] код,
  /// которого нет в `supportedLocales` (на нём `lookupAppLocalizations`
  /// бросает `FlutterError`).
  Locale _narrowToSupported(String languageCode) =>
      languageCode == 'kk' ? const Locale('kk') : const Locale('ru');

  /// Меняет локаль интерфейса: персистит выбор и лучшим усилием сообщает
  /// об этом бэкенду. Язык интерфейса не должен зависеть от сети — любая
  /// ошибка синхронизации молча проглатывается.
  Future<void> setLocale(Locale locale) async {
    state = locale;

    final prefs = ref.read(sharedPreferencesProvider);
    await prefs.setString(_localePrefsKey, locale.languageCode);

    try {
      await ref.read(localeSyncPortProvider).pushLocale(localeToApi(locale));
    } catch (_) {
      // Смена языка интерфейса не должна зависеть от сети/бэкенда.
    }
  }
}
