/// Шина реалтайм-событий SmartQoldau поверх [SqSocket].
library;

import 'sq_event.dart';
import 'sq_socket.dart';

export 'sq_event.dart';
export 'sq_socket.dart';

/// Разбирает сырые события [socket] в типизированный [SqEvent] и даёт
/// удобные операции поверх них: подписку на конкретную консультацию, отправку
/// сообщений/индикатора набора текста, переустановку соединения после
/// обновления токена.
///
/// [stream] — широковещательный: несколько экранов подписываются на него
/// одновременно (реализовано через `.map()` над broadcast-потоком
/// [SqSocket.events] — производные `.map()`/`.where()`-потоки остаются
/// broadcast, пока источник им остаётся).
class SqEvents {
  SqEvents(this._socket);

  final SqSocket _socket;

  /// Поток всех разобранных событий бэкенда.
  late final Stream<SqEvent> stream =
      _socket.events.map((raw) => SqEvent.fromRaw(raw.$1, raw.$2));

  /// Подмножество [stream], относящееся к консультации [consultationId]:
  /// `chat.message`, `chat.typing`, `consultation.updated` с совпадающим
  /// идентификатором. Остальные типы событий (в т.ч. `request.updated` —
  /// он про заявку, не про уже созданную консультацию) в этот поток не
  /// попадают вовсе, а не проходят нефильтрованными.
  ///
  /// Биндинги объектных паттернов ниже намеренно переименованы
  /// (`consultationId: final typingId` вместо `:final consultationId`) —
  /// поле [ChatTypingEvent.consultationId] и параметр метода тут одноимённы,
  /// а деструктурирующий паттерн с сокращённым синтаксисом `:final x`
  /// связывает ЛОКАЛЬНУЮ переменную `x`, которая молча затеняет параметр
  /// метода с тем же именем — сравнение `consultationId == consultationId`
  /// стало бы тавтологией и пропускало вообще все события, а не только
  /// «свои». Тест `forConsultation` ниже специально гоняет события ДВУХ
  /// консультаций одновременно — именно чтобы поймать такой регресс.
  Stream<SqEvent> forConsultation(String consultationId) =>
      stream.where((event) => switch (event) {
            ChatMessageEvent(message: final message) =>
              message.consultationId == consultationId,
            ChatTypingEvent(consultationId: final typingId) =>
              typingId == consultationId,
            ConsultationUpdated(id: final updatedId) =>
              updatedId == consultationId,
            _ => false,
          });

  /// `chat.send` — отправить сообщение [text] в чат консультации
  /// [consultationId].
  void sendChat(String consultationId, String text) => _socket.emit(
        'chat.send',
        {'consultationId': consultationId, 'text': text},
      );

  /// `chat.typing` — сообщить собеседнику, что клиент печатает.
  void sendTyping(String consultationId) =>
      _socket.emit('chat.typing', {'consultationId': consultationId});

  /// Переустанавливает соединение с новым access-токеном [token] — вызывать
  /// после того, как `AuthInterceptor` молча обновил токен (старый токен в
  /// уже установленном handshake становится негодным для последующих
  /// автопереподключений `socket_io_client`).
  Future<void> reconnectWith(String token) => _socket.connect(token);

  /// Состояние соединения (`connecting`/`connected`/`disconnected`) —
  /// индикатор «связь восстанавливается» для звонка (задача 14) и чата.
  /// Прямой проброс [SqSocket.connectionState] — как и
  /// `TokenStore.accessTokenChanges`, обычный broadcast `Stream`, без
  /// повтора текущего значения новому подписчику.
  Stream<SqConnectionState> get connectionState => _socket.connectionState;
}
