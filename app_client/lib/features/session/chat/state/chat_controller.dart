/// Состояние чата консультации: история, реалтайм, отправка и таймер сессии.
library;

import 'dart:async';
import 'dart:developer' as developer;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../../core/analytics_provider.dart';
import '../../../../core/providers.dart';
import '../data/chat_repository.dart';

/// Роль клиента в переписке (`MessageDto.senderRole` бэкенда — обычная
/// строка, не enum).
const clientSenderRole = 'client';

/// Сообщение, отправленное в шину и ещё не подтверждённое сервером.
///
/// Бэкенд рассылает сохранённое сообщение ОБОИМ участникам, включая
/// отправителя, поэтому optimistic-вставки в ленту нет: пузырь живёт
/// отдельным списком со статусом «отправляется», пока не придёт эхо.
class PendingMessage {
  const PendingMessage({
    required this.localId,
    required this.text,
    this.failed = false,
  });

  final int localId;
  final String text;
  final bool failed;

  PendingMessage copyWith({bool? failed}) => PendingMessage(
    localId: localId,
    text: text,
    failed: failed ?? this.failed,
  );
}

class ChatState {
  const ChatState({
    required this.consultation,
    required this.messages,
    required this.status,
    required this.remaining,
    this.pending = const [],
    this.peerTyping = false,
    this.loadingMore = false,
    this.nextCursor,
  });

  final ClientConsultation consultation;

  /// Подтверждённая сервером переписка, от старых к новым.
  final List<ChatMessage> messages;

  /// Отправленные, но ещё не подтверждённые сообщения (поля нет в брифе:
  /// без него негде хранить статус «отправляется»/«не отправлено»).
  final List<PendingMessage> pending;

  final ConsultationStatus status;

  /// Сколько осталось от плановой длительности. Ноль — время вышло; сессию
  /// это не закрывает, исход фиксирует специалист.
  final Duration remaining;

  final bool peerTyping;
  final bool loadingMore;
  final String? nextCursor;

  bool get canSend => status == ConsultationStatus.active;

  ChatState copyWith({
    List<ChatMessage>? messages,
    List<PendingMessage>? pending,
    ConsultationStatus? status,
    Duration? remaining,
    bool? peerTyping,
    bool? loadingMore,
    String? nextCursor,
    bool clearCursor = false,
  }) => ChatState(
    consultation: consultation,
    messages: messages ?? this.messages,
    pending: pending ?? this.pending,
    status: status ?? this.status,
    remaining: remaining ?? this.remaining,
    peerTyping: peerTyping ?? this.peerTyping,
    loadingMore: loadingMore ?? this.loadingMore,
    nextCursor: clearCursor ? null : (nextCursor ?? this.nextCursor),
  );
}

/// Сколько страниц истории дотягивается автоматически при входе. Дальше —
/// по требованию (`loadMore`): при плановых 50 минутах переписка редко
/// длиннее пары страниц, а бесконечный цикл на входе в чат недопустим.
const _autoPageLimit = 10;

/// Как долго держится чужой индикатор «печатает…» после события.
const _peerTypingWindow = Duration(seconds: 3);

/// Не чаще одного `chat.typing` в секунду.
const _typingCooldown = Duration(seconds: 1);

class ChatController extends AutoDisposeFamilyAsyncNotifier<ChatState, String> {
  StreamSubscription<SqEvent>? _consultationEvents;
  StreamSubscription<SqEvent>? _errorEvents;
  Timer? _tick;
  Timer? _peerTypingTimer;
  Timer? _typingCooldownTimer;

  ChatState? _current;

  /// События, пришедшие до конца первой загрузки: применять их не к чему
  /// (состояния ещё нет), а терять нельзя — переигрываются сразу после.
  final List<SqEvent> _earlyEvents = [];

  bool _ready = false;
  bool _disposed = false;
  int _localIdSeq = 0;

  @override
  FutureOr<ChatState> build(String arg) {
    final events = ref.watch(sqEventsProvider);

    // Подписка ДО первой загрузки: сообщение, пришедшее пока грузится
    // история, теряться не должно.
    _consultationEvents = events.forConsultation(arg).listen(_onEvent);
    // `chat.error` не относится к конкретной консультации (в payload'е
    // только код), поэтому в `forConsultation` он не попадает — слушаем
    // общий поток.
    _errorEvents = events.stream
        .where((event) => event is ChatErrorEvent)
        .listen(_onEvent);

    ref.onDispose(() {
      _disposed = true;
      _consultationEvents?.cancel();
      _errorEvents?.cancel();
      _tick?.cancel();
      _peerTypingTimer?.cancel();
      _typingCooldownTimer?.cancel();
    });

    return _load();
  }

  Future<ChatState> _load() async {
    final repo = ref.read(chatRepositoryProvider);
    final consultation = await repo.consultation(arg);

    final messages = <ChatMessage>[];
    final seen = <String>{};
    String? cursor;
    var pages = 0;
    while (pages < _autoPageLimit) {
      final page = await repo.history(arg, cursor: cursor);
      for (final message in page.items) {
        if (seen.add(message.id)) messages.add(message);
      }
      pages++;
      cursor = page.nextCursor;
      if (cursor == null) break;
    }

    final elapsed = DateTime.now().difference(consultation.startedAt);
    final planned = Duration(minutes: consultation.plannedDurationMin);
    final remaining = planned - elapsed;

    final loaded = ChatState(
      consultation: consultation,
      messages: messages,
      status: consultation.status,
      remaining: remaining.isNegative ? Duration.zero : remaining,
      nextCursor: cursor,
    );
    _current = loaded;
    _ready = true;
    if (consultation.status == ConsultationStatus.active) {
      // Сессия началась. Открытая из истории завершённая переписка — это
      // чтение, а не сессия: там события быть не должно.
      ref.read(analyticsProvider).track(
        SessionStarted(
          consultationId: arg,
          format: consultation.format.wireValue,
        ),
      );
    }
    // Переигрываем то, что пришло, пока грузились: подписка открыта раньше
    // запроса именно ради этого окна.
    final buffered = [..._earlyEvents];
    _earlyEvents.clear();
    for (final event in buffered) {
      _onEvent(event);
    }
    _startTick();
    return _current!;
  }

  void _onEvent(SqEvent event) {
    if (_current == null) {
      _earlyEvents.add(event);
      return;
    }
    switch (event) {
      case ChatMessageEvent(message: final message):
        _onIncomingMessage(message);
      case ChatTypingEvent(senderRole: final role):
        // Бэкенд рассылает событие обоим участникам — своё же эхо не
        // должно зажигать «печатает…» у самого себя.
        if (role != clientSenderRole) _startPeerTyping();
      case ChatErrorEvent(code: final code):
        _markSendFailed(code);
      case ConsultationUpdated(status: final status?):
        _onConsultationStatus(status, event.outcome);
      default:
        break;
    }
  }

  /// Смена статуса консультации: завершение или отмена закрывают сессию —
  /// и то и другое считается её концом (ТЗ §10).
  void _onConsultationStatus(
    ConsultationStatus status,
    ConsultationOutcome? outcome,
  ) {
    final current = _current;
    final wasActive = current?.status == ConsultationStatus.active;
    _updateState((state) => state.copyWith(status: status));

    if (!wasActive || status == ConsultationStatus.active) return;
    final consultation = current!.consultation;
    ref.read(analyticsProvider).track(
      SessionEnded(
        consultationId: arg,
        outcome: _outcomeWire(outcome) ?? _statusWire(status),
        durationSec: DateTime.now()
            .difference(consultation.startedAt)
            .inSeconds,
      ),
    );
  }

  /// Проводные значения бэкенда, а не `enum.name`: `clientNoShow` дал бы
  /// «CLIENTNOSHOW», и аналитика разошлась бы с бэкендом.
  String? _outcomeWire(ConsultationOutcome? outcome) => switch (outcome) {
    null => null,
    ConsultationOutcome.completed => 'COMPLETED',
    ConsultationOutcome.clientNoShow => 'CLIENT_NO_SHOW',
    ConsultationOutcome.clientCancelled => 'CLIENT_CANCELLED',
    ConsultationOutcome.techIssue => 'TECH_ISSUE',
  };

  String _statusWire(ConsultationStatus status) => status.wireValue;

  void _onIncomingMessage(ChatMessage message) {
    _updateState((state) {
      if (state.messages.any((m) => m.id == message.id)) return state;

      // Эхо собственного сообщения снимает пузырь «отправляется». Связать
      // его с исходным можно только по тексту: клиентского идентификатора
      // в контракте (`MessageDto`) нет.
      var pending = state.pending;
      if (message.senderRole == clientSenderRole) {
        final index = pending.indexWhere(
          (item) => item.text == message.text && !item.failed,
        );
        if (index >= 0) {
          pending = [...pending]..removeAt(index);
        }
      }

      return state.copyWith(
        messages: [...state.messages, message],
        pending: pending,
      );
    });
  }

  void _markSendFailed(String code) {
    developer.log('chat.send отклонён бэкендом: $code', name: 'ChatController');
    _updateState((state) {
      final index = state.pending.indexWhere((item) => !item.failed);
      if (index < 0) return state;
      final pending = [...state.pending];
      pending[index] = pending[index].copyWith(failed: true);
      return state.copyWith(pending: pending);
    });
  }

  void _startPeerTyping() {
    _peerTypingTimer?.cancel();
    _peerTypingTimer = Timer(
      _peerTypingWindow,
      () => _updateState((state) => state.copyWith(peerTyping: false)),
    );
    _updateState((state) => state.copyWith(peerTyping: true));
  }

  void _startTick() {
    _tick = Timer.periodic(const Duration(seconds: 1), (_) {
      _updateState((state) {
        final next = state.remaining - const Duration(seconds: 1);
        return state.copyWith(
          remaining: next.isNegative ? Duration.zero : next,
        );
      });
    });
  }

  void _updateState(ChatState Function(ChatState state) transform) {
    final current = _current;
    if (current == null) return;
    final next = transform(current);
    if (identical(next, current)) return;
    _current = next;
    if (_ready && !_disposed) state = AsyncData(next);
  }

  /// Отправляет сообщение через шину. HTTP-эндпоинта отправки у бэкенда нет.
  void send(String text) {
    final trimmed = text.trim();
    final current = _current;
    if (trimmed.isEmpty || current == null || !current.canSend) return;

    ref.read(sqEventsProvider).sendChat(arg, trimmed);
    _updateState(
      (state) => state.copyWith(
        pending: [
          ...state.pending,
          PendingMessage(localId: _localIdSeq++, text: trimmed),
        ],
      ),
    );
  }

  /// Повторная отправка сообщения, которое бэкенд отклонил.
  void resend(int localId) {
    final current = _current;
    if (current == null || !current.canSend) return;
    final index = current.pending.indexWhere((item) => item.localId == localId);
    if (index < 0) return;

    final item = current.pending[index];
    ref.read(sqEventsProvider).sendChat(arg, item.text);
    _updateState((state) {
      final pending = [...state.pending];
      pending[index] = item.copyWith(failed: false);
      return state.copyWith(pending: pending);
    });
  }

  /// Сообщает собеседнику, что клиент печатает — не чаще раза в секунду.
  void typing() {
    if (_typingCooldownTimer != null) return;
    final current = _current;
    if (current == null || !current.canSend) return;

    ref.read(sqEventsProvider).sendTyping(arg);
    _typingCooldownTimer = Timer(
      _typingCooldown,
      () => _typingCooldownTimer = null,
    );
  }

  /// Догружает следующую страницу истории (вперёд по времени).
  Future<void> loadMore() async {
    final current = _current;
    final cursor = current?.nextCursor;
    if (current == null || cursor == null || current.loadingMore) return;

    _updateState((state) => state.copyWith(loadingMore: true));
    try {
      final page = await ref
          .read(chatRepositoryProvider)
          .history(arg, cursor: cursor);
      _updateState((state) {
        final ids = state.messages.map((m) => m.id).toSet();
        return state.copyWith(
          messages: [
            ...state.messages,
            ...page.items.where((m) => !ids.contains(m.id)),
          ],
          nextCursor: page.nextCursor,
          clearCursor: page.nextCursor == null,
          loadingMore: false,
        );
      });
    } catch (error) {
      developer.log(
        'догрузка истории не удалась: ${error.runtimeType}',
        name: 'ChatController',
      );
      _updateState((state) => state.copyWith(loadingMore: false));
    }
  }

  /// Отмена консультации клиентом (БП-03).
  Future<void> cancel() async {
    final consultation = await ref.read(chatRepositoryProvider).cancel(arg);
    _updateState((state) => state.copyWith(status: consultation.status));
  }
}

final chatControllerProvider =
    AsyncNotifierProvider.autoDispose.family<ChatController, ChatState, String>(
      ChatController.new,
    );
