/// Абстракция движка звонка.
library;

/// Состояние транспорта звонка — то, что умеет сообщить движок.
enum CallEngineState { connecting, connected, reconnecting, disconnected }

/// Абстракция движка звонка.
///
/// Существует ровно ради тестируемости: `livekit_client` работает через
/// платформенные каналы WebRTC и в headless `flutter test` не поднимается
/// (тот же приём, что `SqSocket` для шины и `PermissionService` для
/// разрешений). Единственная реализация, знающая про `livekit_client`, —
/// `LiveKitCallEngine`.
abstract class CallEngine {
  Stream<CallEngineState> get states;

  Future<void> connect(String url, String token);

  Future<void> disconnect();

  Future<void> setMicEnabled(bool enabled);

  Future<void> setCamEnabled(bool enabled);
}
