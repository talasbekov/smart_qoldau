/// Состояние экрана поиска специалиста: статус заявки, счётчик доступных
/// онлайн, прошедшее время и отмена (прототип `09-search.png`, БП-01).
library;

import 'dart:async';
import 'dart:developer' as developer;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../core/analytics_provider.dart';
import '../../../core/providers.dart';
import '../data/requests_repository.dart';

/// Ключ семейства [searchControllerProvider].
///
/// Бриф задачи называл ключом один `requestId`, но `GET /requests/{id}`
/// бэкенда не возвращает ни темы, ни формата (см. `RequestDto`:
/// `id`/`status`/`isEmergency`/`clientCode` + условные поля матча), а
/// счётчику онлайна ОБА параметра обязательны. Поэтому ключ несёт их с
/// собой — экран получает их от того, кто создал заявку (`extra` роутера).
/// [topicSlug]/[format] опциональны: при возврате на экран по прямой ссылке
/// их может не быть, и тогда счётчик просто не показывается, а сам поиск
/// работает.
class SearchArgs {
  const SearchArgs({
    required this.requestId,
    this.topicSlug,
    this.format,
    this.isEmergency = false,
  });

  final String requestId;
  final String? topicSlug;
  final SessionFormat? format;
  final bool isEmergency;

  bool get hasCountFilter => topicSlug != null && format != null;

  @override
  bool operator ==(Object other) =>
      other is SearchArgs &&
      other.requestId == requestId &&
      other.topicSlug == topicSlug &&
      other.format == format &&
      other.isEmergency == isEmergency;

  @override
  int get hashCode => Object.hash(requestId, topicSlug, format, isEmergency);
}

/// Всё, что рисует экран поиска. [matched]/[consultationId] появляются при
/// `status == matched`, [hotlines] — при `status == callbackRequested`
/// (условное присутствие полей — как в `MatchRequest`).
class SearchState {
  const SearchState({
    required this.status,
    this.matched,
    this.consultationId,
    this.hotlines,
    this.elapsedSec = 0,
    this.onlineCount,
  });

  final RequestStatus status;
  final ExpertPublic? matched;
  final String? consultationId;
  final List<String>? hotlines;

  /// Секунд прошло с открытия экрана (прототип показывает таймер поиска).
  final int elapsedSec;

  /// `null` — счётчик неизвестен (ещё не загружен, недоступен или экран
  /// открыт без темы/формата), а не «ноль специалистов».
  final int? onlineCount;

  bool get isTerminal => status != RequestStatus.searching;

  SearchState copyWith({
    RequestStatus? status,
    ExpertPublic? matched,
    String? consultationId,
    List<String>? hotlines,
    int? elapsedSec,
    int? onlineCount,
  }) => SearchState(
    status: status ?? this.status,
    matched: matched ?? this.matched,
    consultationId: consultationId ?? this.consultationId,
    hotlines: hotlines ?? this.hotlines,
    elapsedSec: elapsedSec ?? this.elapsedSec,
    onlineCount: onlineCount ?? this.onlineCount,
  );
}

/// Как часто растёт таймер на экране.
const _tickInterval = Duration(seconds: 1);

/// Как часто перезапрашивается счётчик «Сейчас онлайн: N».
const _onlineCountInterval = Duration(seconds: 10);

/// Как часто состояние заявки перечитывается через REST.
///
/// Шина — best-effort: `EventsService.safeEmit` бэкенда глотает ошибки
/// отправки, а сокет может быть в переподключении. Без этого опроса
/// единственное потерянное событие оставило бы клиента на экране поиска
/// навсегда, хотя специалист уже найден.
const _pollInterval = Duration(seconds: 15);

class SearchController extends AutoDisposeFamilyAsyncNotifier<SearchState, SearchArgs> {
  Timer? _tick;
  Timer? _countTimer;
  Timer? _pollTimer;
  StreamSubscription<SqEvent>? _subscription;

  /// Источник истины контроллера. Отдельное поле, а не `state.value`:
  /// событие шины может прийти РАНЬШЕ, чем завершится первый
  /// `GET /requests/{id}` (пока `state` — `AsyncLoading`), и его нельзя
  /// потерять.
  SearchState? _current;

  /// `build` завершился и `state` уже можно присваивать.
  bool _ready = false;
  bool _disposed = false;

  /// Запрос соответствующего периодического таймера ещё в полёте. Без этих
  /// флагов медленная сеть (ответ дольше интервала) копила бы параллельные
  /// запросы, а их ответы могли бы прийти не в порядке отправки — счётчик
  /// «Сейчас онлайн» прыгал бы к устаревшему значению.
  bool _countInFlight = false;
  bool _pollInFlight = false;

  @override
  FutureOr<SearchState> build(SearchArgs arg) {
    final events = ref.watch(sqEventsProvider);

    // Подписка ДО первого запроса — иначе событие, пришедшее во время
    // загрузки, прошло бы мимо.
    _subscription = events.stream.listen(_onEvent);

    ref.onDispose(() {
      _disposed = true;
      _stopTimers();
      _subscription?.cancel();
    });

    return _load();
  }

  Future<SearchState> _load() async {
    final repo = ref.read(requestsRepositoryProvider);
    final request = await repo.get(arg.requestId);
    _apply(
      status: request.status,
      matched: request.matchedExpert,
      consultationId: request.consultationId,
      hotlines: request.hotlines,
    );

    final count = await _fetchOnlineCount();
    _current = (_current ?? const SearchState(status: RequestStatus.searching))
        .copyWith(onlineCount: count);

    _ready = true;
    if (!_current!.isTerminal) _startTimers();
    return _current!;
  }

  void _onEvent(SqEvent event) {
    if (event is! RequestUpdated || event.id != arg.requestId) return;
    _apply(
      status: event.status,
      matched: event.matchedExpert,
      consultationId: event.consultationId,
      hotlines: event.hotlines,
    );
  }

  /// Применяет новое состояние заявки.
  ///
  /// Терминальный статус НЕ откатывается обратно в `searching`: ответ
  /// страховочного опроса, отправленный до матча, вполне может прийти
  /// после события о матче — откат вернул бы клиента с экрана «специалист
  /// найден» обратно в поиск.
  void _apply({
    required RequestStatus status,
    ExpertPublic? matched,
    String? consultationId,
    List<String>? hotlines,
  }) {
    final current = _current;
    if (current != null && current.isTerminal) return;

    final next = (current ?? const SearchState(status: RequestStatus.searching))
        .copyWith(
          status: status,
          matched: matched,
          consultationId: consultationId,
          hotlines: hotlines,
        );
    _current = next;
    if (next.isTerminal) _stopTimers();
    if (status == RequestStatus.matched &&
        current?.status != RequestStatus.matched) {
      // Время до соединения — тот самый показатель обещания «1–2 минуты»
      // (ТЗ §11.1); считаем его от открытия экрана поиска, то есть от
      // создания заявки.
      ref.read(analyticsProvider).track(
        ExpertMatched(
          requestId: arg.requestId,
          secondsToMatch: next.elapsedSec,
        ),
      );
    }
    _publish();
  }

  void _publish() {
    if (!_ready || _disposed || _current == null) return;
    state = AsyncData(_current!);
  }

  void _startTimers() {
    _tick = Timer.periodic(_tickInterval, (_) {
      final current = _current;
      if (current == null) return;
      _current = current.copyWith(elapsedSec: current.elapsedSec + 1);
      _publish();
    });

    if (arg.hasCountFilter) {
      _countTimer = Timer.periodic(_onlineCountInterval, (_) async {
        if (_countInFlight) return;
        _countInFlight = true;
        try {
          final count = await _fetchOnlineCount();
          final current = _current;
          if (count == null || current == null) return;
          _current = current.copyWith(onlineCount: count);
          _publish();
        } finally {
          _countInFlight = false;
        }
      });
    }

    _pollTimer = Timer.periodic(_pollInterval, (_) => _poll());
  }

  void _stopTimers() {
    _tick?.cancel();
    _tick = null;
    _countTimer?.cancel();
    _countTimer = null;
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  Future<void> _poll() async {
    if (_pollInFlight) return;
    _pollInFlight = true;
    try {
      final request = await ref.read(requestsRepositoryProvider).get(
        arg.requestId,
      );
      _apply(
        status: request.status,
        matched: request.matchedExpert,
        consultationId: request.consultationId,
        hotlines: request.hotlines,
      );
    } catch (error) {
      // Страховочный опрос — дополнение к шине, а не основной канал: его
      // сбой (сеть моргнула) не должен превращать работающий экран поиска
      // в экран ошибки. Логируем тип, без тела ответа.
      developer.log(
        'страховочный опрос заявки не удался: ${error.runtimeType}',
        name: 'SearchController',
      );
    } finally {
      _pollInFlight = false;
    }
  }

  /// `null` — счётчик получить не удалось (или он неприменим): вызывающий
  /// сохраняет прежнее значение, а не обнуляет показатель.
  Future<int?> _fetchOnlineCount() async {
    if (!arg.hasCountFilter) return null;
    try {
      return await ref.read(requestsRepositoryProvider).onlineCount(
        topicSlug: arg.topicSlug!,
        format: arg.format!,
        urgentOnly: arg.isEmergency ? true : null,
      );
    } catch (error) {
      developer.log(
        'счётчик доступных экспертов недоступен: ${error.runtimeType}',
        name: 'SearchController',
      );
      return null;
    }
  }

  /// «Отменить поиск». Ошибку не глотает — экран показывает её пользователю
  /// (кнопка остаётся доступной для повторной попытки).
  Future<void> cancel() async {
    final request = await ref.read(requestsRepositoryProvider).cancel(
      arg.requestId,
    );
    _apply(
      status: request.status,
      matched: request.matchedExpert,
      consultationId: request.consultationId,
      hotlines: request.hotlines,
    );
  }
}

final searchControllerProvider =
    AsyncNotifierProvider.autoDispose.family<SearchController, SearchState, SearchArgs>(
      SearchController.new,
    );
