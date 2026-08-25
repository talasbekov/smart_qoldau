/// Реализация [CallEngine] поверх `livekit_client`.
///
/// Единственное место проекта, знающее про `livekit_client`: всё остальное
/// (контроллер, экран, тесты) работает через абстракцию [CallEngine] —
/// WebRTC требует платформенных каналов и в headless-тесте не поднимается.
library;

import 'dart:async';
import 'dart:developer' as developer;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:livekit_client/livekit_client.dart' as lk;

import 'call_engine.dart';

class LiveKitCallEngine implements CallEngine {
  LiveKitCallEngine() {
    _listener = _room.createListener();
    _listener
      ..on<lk.RoomConnectedEvent>(
        (_) => _states.add(CallEngineState.connected),
      )
      ..on<lk.RoomReconnectingEvent>(
        (_) => _states.add(CallEngineState.reconnecting),
      )
      ..on<lk.RoomReconnectedEvent>(
        (_) => _states.add(CallEngineState.connected),
      )
      ..on<lk.RoomDisconnectedEvent>(
        (_) => _states.add(CallEngineState.disconnected),
      );
  }

  final lk.Room _room = lk.Room();
  late final lk.EventsListener<lk.RoomEvent> _listener;
  final _states = StreamController<CallEngineState>.broadcast();

  /// Комната LiveKit — нужна экрану, чтобы отрисовать дорожки участников.
  lk.Room get room => _room;

  @override
  Stream<CallEngineState> get states => _states.stream;

  @override
  Future<void> connect(String url, String token) async {
    _states.add(CallEngineState.connecting);
    await _room.connect(url, token);
  }

  @override
  Future<void> disconnect() async {
    try {
      await _room.disconnect();
    } catch (error) {
      // Отключение «на всякий случай» (уход с экрана, повторный вызов)
      // вполне может застать комнату уже отключённой — это не ошибка
      // пользователя, а нормальный порядок уборки.
      developer.log(
        'разрыв соединения звонка: ${error.runtimeType}',
        name: 'LiveKitCallEngine',
      );
    }
  }

  @override
  Future<void> setMicEnabled(bool enabled) async {
    await _room.localParticipant?.setMicrophoneEnabled(enabled);
  }

  @override
  Future<void> setCamEnabled(bool enabled) async {
    await _room.localParticipant?.setCameraEnabled(enabled);
  }

  Future<void> dispose() async {
    await _listener.dispose();
    await _room.dispose();
    await _states.close();
  }
}

/// Движок звонка. В тестах переопределяется фейком
/// (`callEngineProvider.overrideWithValue`).
final callEngineProvider = Provider<CallEngine>((ref) {
  final engine = LiveKitCallEngine();
  ref.onDispose(engine.dispose);
  return engine;
});
