/// Состояние главного экрана: справочник тем и активная консультация
/// клиента (если есть).
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../core/locale_controller.dart';
import '../data/topics_repository.dart';

/// Данные, которых достаточно, чтобы отрисовать главный экран.
///
/// Без счётчика «Сейчас онлайн: N»: он есть в тексте брифа задачи 7, но
/// прототип `07-home.png` его на главном экране не показывает вовсе (счётчик
/// живёт на экране поиска эксперта, задача 10) — заводить неиспользуемое
/// поле ради текста брифа, когда сам прототип, на который бриф ссылается,
/// его не рисует, значило бы тащить мёртвый код. Эндпоинт счётчика к тому же
/// появляется только в задаче 9. См. отчёт задачи 7, пункт про
/// disambiguation №4.
class HomeState {
  const HomeState({required this.topics, required this.active});

  final List<Topic> topics;
  final ClientConsultation? active;
}

/// Бросается, когда `GET /topics` ответил успешно, но список тем оказался
/// пустым. По брифу задачи 7 это тоже ошибка экрана (`SqErrorView` с
/// «Повторить»), а не пустой экран: пустой справочник тем — аномалия
/// бэкенда (справочник — не пользовательские данные, он не может быть
/// легитимно пустым), а не состояние «пока нечего показать».
class HomeTopicsEmptyException implements Exception {
  const HomeTopicsEmptyException();
}

class HomeController extends AsyncNotifier<HomeState> {
  @override
  FutureOr<HomeState> build() => _load();

  Future<HomeState> _load() async {
    final repo = ref.read(topicsRepositoryProvider);
    final locale = localeToApi(ref.read(localeControllerProvider));

    final topics = await repo.topics(locale: locale);
    if (topics.isEmpty) throw const HomeTopicsEmptyException();

    ClientConsultation? active;
    try {
      active = await repo.activeConsultation();
    } catch (_) {
      // Баннер активной консультации — необязательное дополнение экрана:
      // сбой ЕГО загрузки не должен превращать в ошибку весь главный экран,
      // раз темы (основное содержимое) загрузились успешно.
      active = null;
    }

    return HomeState(topics: topics, active: active);
  }

  /// Кнопка «Повторить» на `SqErrorView`.
  Future<void> retry() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(_load);
  }
}

final homeControllerProvider =
    AsyncNotifierProvider<HomeController, HomeState>(HomeController.new);
