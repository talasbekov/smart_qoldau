/// Аудио- и видеозвонок консультации: разрешения, токен, соединение.
library;

import 'dart:async';
import 'dart:developer' as developer;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

export 'call_engine.dart';
export 'livekit_call_engine.dart' show callEngineProvider;

enum CallPhase {
  idle,
  connecting,
  connected,
  reconnecting,
  disconnected,
  permissionDenied,
  failed,
}

class CallState {
  const CallState({
    this.phase = CallPhase.idle,
    this.format = SessionFormat.audio,
    this.micEnabled = true,
    this.camEnabled = true,
    this.cameraBlocked = false,
    this.offerChatFallback = false,
    this.errorCode,
  });

  final CallPhase phase;

  /// Формат, в котором звонок реально идёт: при отказе в камере видео
  /// понижается до аудио, и это видно здесь.
  final SessionFormat format;

  final bool micEnabled;
  final bool camEnabled;

  /// Камеры нет по решению пользователя — кнопку включения камеры показывать
  /// бессмысленно, нужен путь в настройки.
  final bool cameraBlocked;

  /// Связь не восстановилась за отведённое время — предлагаем продолжить в
  /// чате (ТЗ §6, деградация вместо обрыва).
  final bool offerChatFallback;

  final String? errorCode;

  CallState copyWith({
    CallPhase? phase,
    SessionFormat? format,
    bool? micEnabled,
    bool? camEnabled,
    bool? cameraBlocked,
    bool? offerChatFallback,
    String? errorCode,
  }) => CallState(
    phase: phase ?? this.phase,
    format: format ?? this.format,
    micEnabled: micEnabled ?? this.micEnabled,
    camEnabled: camEnabled ?? this.camEnabled,
    cameraBlocked: cameraBlocked ?? this.cameraBlocked,
    offerChatFallback: offerChatFallback ?? this.offerChatFallback,
    errorCode: errorCode ?? this.errorCode,
  );
}

/// Сколько ждём восстановления связи, прежде чем предложить чат (ТЗ §6).
const reconnectGracePeriod = Duration(seconds: 30);

class CallController extends AutoDisposeFamilyNotifier<CallState, String> {
  StreamSubscription<CallEngineState>? _engineStates;
  Timer? _reconnectDeadline;

  @override
  CallState build(String arg) {
    final engine = ref.watch(callEngineProvider);
    _engineStates = engine.states.listen(_onEngineState);

    ref.onDispose(() {
      _engineStates?.cancel();
      _reconnectDeadline?.cancel();
      // Звонок не должен пережить экран: движок отпускаем явно.
      engine.disconnect();
    });

    return const CallState();
  }

  /// Начинает звонок в [format] — он же путь эскалации (чат → аудио →
  /// видео): бэкенд по тому же `media-token` меняет формат консультации и
  /// рассылает `consultation.updated`.
  Future<void> start(SessionFormat format) async {
    final permissions = ref.read(permissionServiceProvider);

    final micGranted = await permissions.ensure(SqPermission.microphone);
    if (!micGranted) {
      // Без микрофона звонка нет — токен не запрашиваем вовсе, чтобы не
      // менять формат консультации на бэкенде впустую.
      state = state.copyWith(phase: CallPhase.permissionDenied);
      return;
    }

    var effectiveFormat = format;
    var cameraBlocked = false;
    if (format == SessionFormat.video) {
      final camGranted = await permissions.ensure(SqPermission.camera);
      if (!camGranted) {
        // Микрофон есть — говорить можно. Ронять из-за камеры весь звонок
        // посреди консультации хуже, чем начать его без картинки.
        effectiveFormat = SessionFormat.audio;
        cameraBlocked = true;
      }
    }

    state = state.copyWith(
      phase: CallPhase.connecting,
      format: effectiveFormat,
      cameraBlocked: cameraBlocked,
      camEnabled: !cameraBlocked,
      offerChatFallback: false,
    );

    try {
      final token = await ref
          .read(mediaRepositoryProvider)
          .token(arg, format: effectiveFormat);
      await ref.read(callEngineProvider).connect(token.url, token.token);
    } on ApiException catch (error) {
      developer.log(
        'медиа-токен не выдан: ${error.code}',
        name: 'CallController',
      );
      state = state.copyWith(phase: CallPhase.failed, errorCode: error.code);
    } catch (error) {
      developer.log(
        'подключение к звонку не удалось: ${error.runtimeType}',
        name: 'CallController',
      );
      state = state.copyWith(phase: CallPhase.failed);
    }
  }

  void _onEngineState(CallEngineState engineState) {
    switch (engineState) {
      case CallEngineState.connecting:
        state = state.copyWith(phase: CallPhase.connecting);
      case CallEngineState.connected:
        _reconnectDeadline?.cancel();
        _reconnectDeadline = null;
        state = state.copyWith(
          phase: CallPhase.connected,
          offerChatFallback: false,
        );
      case CallEngineState.reconnecting:
        _startReconnectDeadline();
        state = state.copyWith(phase: CallPhase.reconnecting);
      case CallEngineState.disconnected:
        _reconnectDeadline?.cancel();
        _reconnectDeadline = null;
        state = state.copyWith(phase: CallPhase.disconnected);
    }
  }

  void _startReconnectDeadline() {
    _reconnectDeadline?.cancel();
    _reconnectDeadline = Timer(reconnectGracePeriod, () {
      state = state.copyWith(
        phase: CallPhase.failed,
        offerChatFallback: true,
      );
    });
  }

  Future<void> toggleMic() async {
    final enabled = !state.micEnabled;
    await ref.read(callEngineProvider).setMicEnabled(enabled);
    state = state.copyWith(micEnabled: enabled);
  }

  Future<void> toggleCam() async {
    if (state.cameraBlocked) return;
    final enabled = !state.camEnabled;
    await ref.read(callEngineProvider).setCamEnabled(enabled);
    state = state.copyWith(camEnabled: enabled);
  }

  /// «Завершить»: кладёт трубку. Исход консультации клиент НЕ фиксирует —
  /// это делает специалист (БП-03), поэтому никаких вызовов отмены.
  Future<void> hangUp() async {
    _reconnectDeadline?.cancel();
    _reconnectDeadline = null;
    await ref.read(callEngineProvider).disconnect();
    state = state.copyWith(phase: CallPhase.disconnected);
  }

  /// Открывает системные настройки — путь для «отказал навсегда».
  Future<void> openSettings() =>
      ref.read(permissionServiceProvider).openSettings();
}

final callControllerProvider =
    NotifierProvider.autoDispose.family<CallController, CallState, String>(
      CallController.new,
    );
