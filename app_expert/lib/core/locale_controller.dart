/// Управление активной локалью интерфейса эксперта — копия
/// `app_client/lib/core/locale_controller.dart` (задача 16 E7): своя, не
/// переиспользованная из `shared` — она уже привязана к
/// `SharedPreferences`-ключу и системной локали конкретного приложения,
/// дублирование трёх строк дешевле абстракции ради одного метода (тот же
/// принцип, что `NoteEditor`/`OutcomeSheet` задачи 13).
///
/// Локализация экранов (`AppLocalizations`) появится задачей 17 — до тех
/// пор [LocaleController] хранит и синхронизирует ВЫБОР языка (влияет на
/// язык серверных пушей/уведомлений через `PATCH /me/locale`), а UI-текст
/// остаётся русским хардкодом.
library;

import 'dart:ui' show Locale, PlatformDispatcher;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _localePrefsKey = 'sq.locale';

/// Провайдер [SharedPreferences]. Инстанс асинхронный, поэтому прогревается
/// один раз в `main()` до `runApp` и передаётся сюда через
/// `overrideWithValue`.
final sharedPreferencesProvider = Provider<SharedPreferences>((ref) {
  throw UnimplementedError(
    'sharedPreferencesProvider должен быть переопределён в main() '
    'реальным SharedPreferences.getInstance()',
  );
});

final systemLocaleProvider = Provider<Locale>(
  (ref) => PlatformDispatcher.instance.locale,
);

/// Узкий порт синхронизации локали с бэкендом (`PATCH /me/locale`).
abstract class LocaleSyncPort {
  Future<void> pushLocale(String apiLocale);
}

class SqApiLocaleSync implements LocaleSyncPort {
  const SqApiLocaleSync(this._api);

  final SqApi _api;

  @override
  Future<void> pushLocale(String apiLocale) => _api.updateLocale(apiLocale);
}

final localeSyncPortProvider = Provider<LocaleSyncPort>(
  (ref) => SqApiLocaleSync(ref.watch(sqApiProvider)),
);

final localeControllerProvider = NotifierProvider<LocaleController, Locale>(
  LocaleController.new,
);

class LocaleController extends Notifier<Locale> {
  @override
  Locale build() {
    final prefs = ref.watch(sharedPreferencesProvider);
    final saved = prefs.getString(_localePrefsKey);
    if (saved != null) return _narrowToSupported(saved);

    final system = ref.watch(systemLocaleProvider);
    return _narrowToSupported(system.languageCode);
  }

  /// Сужает произвольный код языка до одной из двух поддерживаемых локалей
  /// (`kk` → казахский, всё остальное → русский) — тот же приём, что
  /// `app_client`.
  Locale _narrowToSupported(String languageCode) =>
      languageCode == 'kk' ? const Locale('kk') : const Locale('ru');

  /// Меняет локаль: персистит выбор и лучшим усилием сообщает бэкенду.
  /// Сбой синхронизации молча проглатывается — язык интерфейса не должен
  /// зависеть от сети.
  Future<void> setLocale(Locale locale) async {
    state = locale;

    final prefs = ref.read(sharedPreferencesProvider);
    await prefs.setString(_localePrefsKey, locale.languageCode);

    try {
      await ref.read(localeSyncPortProvider).pushLocale(localeToApi(locale));
    } catch (_) {
      // best-effort
    }
  }
}
