/// Состояние и контроллер анкеты онбординга эксперта (2 шага: профиль +
/// темы).
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

/// Черновик шага 1 (профиль) — переносится между `ProfileStepScreen` и
/// `TopicsStepScreen` через `extra` навигации `go_router`: у эксперта нет
/// отдельного постоянного стора анкеты (сама анкета живёт только на время
/// прохождения онбординга), а поднимать промежуточное состояние в
/// [OnboardingController] означало бы городить дополнительный `setState`-
/// подобный метод ради двух полей экрана. Простая неизменяемая структура
/// достаточна и тестируется тривиально.
class ProfileDraft {
  const ProfileDraft({
    required this.displayName,
    required this.city,
    required this.experience,
    required this.education,
    required this.priceTiyn,
    required this.languages,
    required this.formats,
  });

  final String displayName;
  final String city;
  final ExperienceLevel experience;
  final String education;
  final int priceTiyn;
  final List<String> languages;
  final List<SessionFormat> formats;
}

/// Управляет отправкой анкеты онбординга: `submit()` вызывает
/// `SqApiExpertProfile.createExpert`, при `EXPERT_EXISTS` — не ошибка
/// (анкета уже была отправлена с прошлой попытки), а прозрачный переход к
/// уже существующему профилю через `me()`, тем же путём кладущий результат
/// в состояние.
class OnboardingController extends AsyncNotifier<ExpertMe?> {
  @override
  FutureOr<ExpertMe?> build() => null;

  SqApi get _api => ref.read(sqApiProvider);

  /// `POST /experts` — создать анкету специалиста. При `EXPERT_EXISTS`
  /// вместо проброса исключения читает существующий профиль через `me()` —
  /// повторная отправка формы (например, после обрыва связи на предыдущей
  /// попытке) не должна показывать пользователю ошибку там, где анкета уже
  /// принята.
  Future<void> submit({
    required String displayName,
    required String city,
    required ExperienceLevel experience,
    required String education,
    required int priceTiyn,
    required List<String> languages,
    required List<SessionFormat> formats,
    required List<String> topicSlugs,
  }) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      try {
        return await _api.createExpert(
          displayName: displayName,
          city: city,
          experience: experience,
          education: education,
          priceTiyn: priceTiyn,
          languages: languages,
          formats: formats,
          topicSlugs: topicSlugs,
        );
      } on ApiException catch (e) {
        if (e.code != ApiErrorCode.expertExists) rethrow;
        return _api.me();
      }
    });
  }
}

final onboardingControllerProvider =
    AsyncNotifierProvider<OnboardingController, ExpertMe?>(
      OnboardingController.new,
    );
