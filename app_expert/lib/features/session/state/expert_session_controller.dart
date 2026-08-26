/// Состояние сессии консультации со стороны эксперта (E7 задача 13):
/// история переписки, реалтайм, таймер оставшегося времени.
///
/// НЕ переиспользует `ChatController` из `shared` (задача 2) — тот
/// парсит `GET /consultations/{id}` как `ClientConsultation`
/// (обязательное поле `expert`), что падает `TypeError` на экспертском
/// ответе бэкенда (`clientCode`/`topicSlug` вместо `expert` — форма ответа
/// зависит от РОЛИ вызывающего, не от query-параметра, см.
/// `ConsultationsService.findForParticipant`). Этот контроллер —
/// параллельный, экспертский, поверх той же шины (`SqEvents.forConsultation`)
/// и тех же примитивов отправки (`sendChat`), но без оптимистичных
/// «отправляется»-пузырей и индикатора «печатает» клиента — сокращение
/// объёма задачи 13, не требуется бизнес-логикой (эксперт видит и так
/// быстрое эхо через WS).
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../consultations/data/expert_consultations_repository.dart';

class ExpertSessionState {
  const ExpertSessionState({
    required this.consultation,
    required this.messages,
    required this.remaining,
  });

  final ConsultationExpertDto consultation;
  final List<ChatMessage> messages;

  /// Сколько осталось от плановой длительности. Ноль — время вышло; это
  /// не закрывает сессию само по себе, исход фиксирует эксперт.
  final Duration remaining;

  bool get canSend => consultation.status == ConsultationStatus.active;

  ExpertSessionState copyWith({
    ConsultationExpertDto? consultation,
    List<ChatMessage>? messages,
    Duration? remaining,
  }) => ExpertSessionState(
    consultation: consultation ?? this.consultation,
    messages: messages ?? this.messages,
    remaining: remaining ?? this.remaining,
  );
}

class ExpertSessionController
    extends AutoDisposeFamilyAsyncNotifier<ExpertSessionState, String> {
  StreamSubscription<SqEvent>? _subscription;
  Timer? _tick;

  ExpertSessionState? _current;
  bool _ready = false;
  bool _disposed = false;

  @override
  FutureOr<ExpertSessionState> build(String arg) {
    final events = ref.watch(sqEventsProvider);
    // Подписка ДО первой загрузки — событие, пришедшее пока грузится
    // история, теряться не должно (тот же приём, что `ChatController`).
    _subscription = events.forConsultation(arg).listen(_onEvent);

    ref.onDispose(() {
      _disposed = true;
      _subscription?.cancel();
      _tick?.cancel();
    });

    return _load();
  }

  Future<ExpertSessionState> _load() async {
    final consultation = await ref
        .read(expertConsultationsRepositoryProvider)
        .byId(arg);
    final history = await ref.read(sqApiProvider).consultationMessages(arg);

    final elapsed = DateTime.now().difference(consultation.startedAt);
    final planned = Duration(minutes: consultation.plannedDurationMin);
    final remaining = planned - elapsed;

    _current = ExpertSessionState(
      consultation: consultation,
      messages: history.items,
      remaining: remaining.isNegative ? Duration.zero : remaining,
    );
    _ready = true;
    _startTick();
    return _current!;
  }

  void _startTick() {
    _tick?.cancel();
    _tick = Timer.periodic(const Duration(seconds: 1), (_) {
      final current = _current;
      if (current == null) return;
      final remaining = current.remaining - const Duration(seconds: 1);
      _current = current.copyWith(
        remaining: remaining.isNegative ? Duration.zero : remaining,
      );
      _publish();
    });
  }

  void _onEvent(SqEvent event) {
    final current = _current;
    if (current == null) return;

    switch (event) {
      case ChatMessageEvent(message: final message):
        _current = current.copyWith(messages: [...current.messages, message]);
      case ConsultationUpdated():
        _current = current.copyWith(
          consultation: current.consultation.copyWith(
            status: event.status ?? current.consultation.status,
            outcome: event.outcome ?? current.consultation.outcome,
            paymentStatus:
                event.paymentStatus ?? current.consultation.paymentStatus,
            format: event.format ?? current.consultation.format,
          ),
        );
      default:
        return;
    }
    _publish();
  }

  void _publish() {
    if (!_ready || _disposed || _current == null) return;
    state = AsyncData(_current!);
  }

  /// `chat.send` через шину — фактическое сообщение придёт эхом
  /// (`chat.message`), отдельного REST-эндпоинта отправки у бэкенда нет
  /// (см. `ChatRepository` в `shared`).
  void send(String text) {
    if (state.valueOrNull?.canSend != true) return;
    ref.read(sqEventsProvider).sendChat(arg, text);
  }
}

final expertSessionControllerProvider = AsyncNotifierProvider.autoDispose
    .family<ExpertSessionController, ExpertSessionState, String>(
      ExpertSessionController.new,
    );
