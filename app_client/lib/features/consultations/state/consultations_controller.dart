/// Списки консультаций клиента: активные и история.
library;

import 'dart:async';
import 'dart:developer' as developer;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/locale_controller.dart';
import '../../review/data/reviews_repository.dart';
import '../../review/state/review_controller.dart';
import '../data/consultations_repository.dart';

/// Вкладки раздела. История — это два статуса бэкенда сразу: фильтр
/// `GET /consultations?status=` принимает ровно один, а вкладка должна
/// показывать и завершённые, и отменённые.
enum ConsultationsTab { active, history }

/// Размер страницы списка.
const consultationsPageSize = 20;

class ConsultationsController
    extends
        AutoDisposeFamilyAsyncNotifier<
          List<ClientConsultation>,
          ConsultationsTab
        > {
  StreamSubscription<SqEvent>? _events;

  /// Сколько уже загружено по каждому статусу — для `skip` следующей
  /// страницы. У истории два независимых курсора.
  final Map<ConsultationStatus, int> _loaded = {};

  bool _loadingMore = false;

  @override
  FutureOr<List<ClientConsultation>> build(ConsultationsTab arg) {
    final events = ref.watch(sqEventsProvider);
    _events = events.stream.listen(_onEvent);
    ref.onDispose(() => _events?.cancel());

    return _loadFirstPage();
  }

  List<ConsultationStatus> get _statuses => switch (arg) {
    // Плановые записи живут на той же вкладке, что и идущие сейчас: для
    // клиента это одно и то же — «предстоит».
    ConsultationsTab.active => [
      ConsultationStatus.scheduled,
      ConsultationStatus.active,
    ],
    ConsultationsTab.history => [
      ConsultationStatus.completed,
      ConsultationStatus.cancelled,
    ],
  };

  Future<List<ClientConsultation>> _loadFirstPage() async {
    _loaded.clear();
    final pages = await Future.wait(
      _statuses.map(
        (status) => ref
            .read(consultationsRepositoryProvider)
            .list(status: status, take: consultationsPageSize, skip: 0),
      ),
    );
    for (var i = 0; i < _statuses.length; i++) {
      _loaded[_statuses[i]] = pages[i].length;
    }
    return _merge(pages.expand((page) => page));
  }

  /// Склеивает статусы в один список: новые сверху, дубли по id убраны
  /// (страницы разных статусов пересекаться не должны, но повторный
  /// элемент в списке выглядел бы как вторая консультация).
  List<ClientConsultation> _merge(Iterable<ClientConsultation> items) {
    final byId = <String, ClientConsultation>{};
    for (final item in items) {
      byId[item.id] = item;
    }
    final list = byId.values.toList()
      ..sort((a, b) => b.startedAt.compareTo(a.startedAt));
    return list;
  }

  Future<void> refresh() async {
    state = await AsyncValue.guard(_loadFirstPage);
  }

  /// Догружает следующую страницу по каждому статусу вкладки.
  Future<void> loadMore() async {
    final current = state.valueOrNull;
    if (current == null || _loadingMore) return;
    _loadingMore = true;
    try {
      final pages = await Future.wait(
        _statuses.map(
          (status) => ref
              .read(consultationsRepositoryProvider)
              .list(
                status: status,
                take: consultationsPageSize,
                skip: _loaded[status] ?? 0,
              ),
        ),
      );
      for (var i = 0; i < _statuses.length; i++) {
        _loaded[_statuses[i]] = (_loaded[_statuses[i]] ?? 0) + pages[i].length;
      }
      state = AsyncData(_merge([...current, ...pages.expand((page) => page)]));
    } catch (error) {
      developer.log(
        'догрузка консультаций не удалась: ${error.runtimeType}',
        name: 'ConsultationsController',
      );
    } finally {
      _loadingMore = false;
    }
  }

  /// Применяет событие к уже загруженной карточке — без перезапроса списка:
  /// перезапрос на каждое изменение статуса оплаты дёргал бы список под
  /// пальцем и стоил бы лишнего круга сети.
  void _onEvent(SqEvent event) {
    if (event is! ConsultationUpdated) return;
    final current = state.valueOrNull;
    if (current == null) return;

    final index = current.indexWhere((item) => item.id == event.id);
    if (index < 0) return;

    final item = current[index];
    final updated = item.copyWith(
      status: event.status ?? item.status,
      outcome: event.outcome ?? item.outcome,
      paymentStatus: event.paymentStatus ?? item.paymentStatus,
      format: event.format ?? item.format,
      startedAt: event.startedAt ?? item.startedAt,
    );

    // Консультация ушла из этой вкладки (например, активная завершилась) —
    // убираем её отсюда: показывать завершённую среди активных нельзя.
    final belongs = _statuses.contains(updated.status);
    final next = [...current];
    if (belongs) {
      next[index] = updated;
    } else {
      next.removeAt(index);
    }
    state = AsyncData(next);
  }

  /// Отмена активной консультации (БП-03).
  ///
  /// `CONSULTATION_NOT_ACTIVE` — не ошибка пользователя, а гонка: её уже
  /// завершил специалист. Молча перечитываем список.
  Future<void> cancel(String consultationId) async {
    try {
      await ref.read(consultationsRepositoryProvider).cancel(consultationId);
      await refresh();
    } on ApiException catch (error) {
      if (error.code == ApiErrorCode.consultationNotActive) {
        await refresh();
        return;
      }
      rethrow;
    }
  }
}

final consultationsControllerProvider = AsyncNotifierProvider.autoDispose
    .family<
      ConsultationsController,
      List<ClientConsultation>,
      ConsultationsTab
    >(ConsultationsController.new);

/// Состояние собственного отзыва по консультации: идентификатор приходит с
/// бэкенда (`ConsultationClientDto.reviewId`, E2a), и его можно удалить
/// (ТЗ §5.7).
class MyReviewState {
  const MyReviewState({this.reviewId, this.deleting = false, this.errorCode});

  /// `null` — отзыва по этой консультации нет. Значение приходит с
  /// бэкенда, поэтому переустановка приложения его не теряет; локальная
  /// запись осталась только фолбэком на время, пока консультация ещё не
  /// загрузилась.
  final String? reviewId;

  final bool deleting;
  final String? errorCode;
}

class MyReviewController
    extends AutoDisposeFamilyNotifier<MyReviewState, String> {
  @override
  MyReviewState build(String arg) => MyReviewState(
    // Источник истины — DTO консультации; локальная запись подставляется,
    // пока запрос не завершился (или если он не удался).
    reviewId:
        ref.watch(consultationProvider(arg)).valueOrNull?.reviewId ??
        ref.watch(sharedPreferencesProvider).getString(reviewIdKey(arg)),
  );

  /// Удаляет свой отзыв. `REVIEW_NOT_FOUND` считается успехом: отзыва уже
  /// нет (например, снят модерацией), и оставлять локальный флаг значило бы
  /// навсегда запретить клиенту оценить эту консультацию.
  Future<void> delete() async {
    final prefs = ref.read(sharedPreferencesProvider);
    final reviewId = state.reviewId ?? prefs.getString(reviewIdKey(arg));
    if (reviewId == null) return;

    state = MyReviewState(reviewId: reviewId, deleting: true);
    try {
      await ref.read(reviewsRepositoryProvider).delete(reviewId);
      await _forgetLocalReview(prefs);
      state = const MyReviewState();
    } on ApiException catch (error) {
      if (error.code == ApiErrorCode.reviewNotFound) {
        await _forgetLocalReview(prefs);
        state = const MyReviewState();
        return;
      }
      developer.log(
        'отзыв не удалён: ${error.code}',
        name: 'MyReviewController',
      );
      state = MyReviewState(reviewId: reviewId, errorCode: error.code);
    }
  }

  Future<void> _forgetLocalReview(SharedPreferences prefs) async {
    await prefs.remove(reviewedFlagKey(arg));
    await prefs.remove(reviewIdKey(arg));
  }
}

final myReviewControllerProvider = NotifierProvider.autoDispose
    .family<MyReviewController, MyReviewState, String>(MyReviewController.new);
