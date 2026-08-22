/// Флаги прогресса онбординга.
///
/// Хранятся в [SharedPreferences], а не в secure storage (в отличие от
/// `TokenStore`) — это не секреты, просто «пользователь уже видел это».
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/locale_controller.dart' show sharedPreferencesProvider;

const _slidesKey = 'sq.onboarding.slides';
const _permissionsKey = 'sq.onboarding.permissions';

/// Флаги онбординга поверх [SharedPreferences]: видел ли пользователь
/// вводные слайды ([seenSlides]) и был ли ему уже показан экран запроса
/// разрешений ([askedPermissions]).
class OnboardingFlags {
  const OnboardingFlags(this._prefs);

  final SharedPreferences _prefs;

  bool get seenSlides => _prefs.getBool(_slidesKey) ?? false;

  Future<void> setSeenSlides(bool value) => _prefs.setBool(_slidesKey, value);

  bool get askedPermissions => _prefs.getBool(_permissionsKey) ?? false;

  Future<void> setAskedPermissions(bool value) =>
      _prefs.setBool(_permissionsKey, value);
}

final onboardingFlagsProvider = Provider<OnboardingFlags>(
  (ref) => OnboardingFlags(ref.watch(sharedPreferencesProvider)),
);
