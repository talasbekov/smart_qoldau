// Юнит-тесты IncomingOfferController (Step 1 брифа задачи 11 эпика E7):
// offer.new кладёт оффер в состояние и показывает алерт РОВНО один раз;
// offer.revoked с ДРУГИМ offerId не чистит текущий оффер (регрессия на
// подстановку чужого id); дедлайн истекает — состояние чистится само, без
// второго события. Управление временем — виртуальное (`tester.pump`), тот
// же приём, что в `search_controller_test.dart` (app_client).
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_expert/core/incoming_offer_alert_port.dart';
import 'package:app_expert/features/offers/state/incoming_offer_controller.dart';

class MockIncomingOfferAlertPort extends Mock
    implements IncomingOfferAlertPort {}

class _FakeSqSocket implements SqSocket {
  final _events = StreamController<(String, dynamic)>.broadcast();

  void push(String event, dynamic data) => _events.add((event, data));

  @override
  Stream<(String, dynamic)> get events => _events.stream;

  @override
  Stream<SqConnectionState> get connectionState => const Stream.empty();

  @override
  void emit(String event, dynamic data) {}

  @override
  Future<void> connect(String token) async {}

  @override
  Future<void> disconnect() async {}

  Future<void> dispose() => _events.close();
}

Map<String, dynamic> _rawOffer({
  String offerId = 'offer-1',
  required String deadlineAt,
}) => {
  'offerId': offerId,
  'topicSlug': 'anxiety-stress',
  'format': 'video',
  'isEmergency': true,
  'clientCode': 4821,
  'deadlineAt': deadlineAt,
};

ProviderContainer _container({
  required SqSocket socket,
  required IncomingOfferAlertPort port,
}) {
  final container = ProviderContainer(
    overrides: [
      sqEventsProvider.overrideWithValue(SqEvents(socket)),
      incomingOfferAlertPortProvider.overrideWithValue(port),
    ],
  );
  addTearDown(container.dispose);
  container.listen(
    incomingOfferControllerProvider,
    (previous, next) {},
    fireImmediately: true,
  );
  return container;
}

void _disposeNow(ProviderContainer container) => container.dispose();

void main() {
  setUpAll(() {
    registerFallbackValue(
      OfferNew(
        offerId: 'fallback',
        topicSlug: 'x',
        format: SessionFormat.chat,
        isEmergency: false,
        clientCode: 1,
        deadlineAt: DateTime(2026),
      ),
    );
  });

  late _FakeSqSocket socket;
  late MockIncomingOfferAlertPort port;

  setUp(() {
    socket = _FakeSqSocket();
    addTearDown(socket.dispose);
    port = MockIncomingOfferAlertPort();
  });

  testWidgets(
    'offer.new кладёт оффер в состояние и показывает алерт один раз',
    (tester) async {
      final container = _container(socket: socket, port: port);
      await tester.pump();

      final deadline = DateTime.now().add(const Duration(seconds: 45));
      socket.push(
        'offer.new',
        _rawOffer(deadlineAt: deadline.toIso8601String()),
      );
      await tester.pump();

      final state = container.read(incomingOfferControllerProvider);
      expect(state, isA<OfferNew>());
      expect(state!.offerId, 'offer-1');
      verify(() => port.show(any(that: isA<OfferNew>()))).called(1);

      _disposeNow(container);
    },
  );

  testWidgets('offer.revoked с ДРУГИМ offerId не чистит текущий оффер', (
    tester,
  ) async {
    final container = _container(socket: socket, port: port);
    await tester.pump();

    final deadline = DateTime.now().add(const Duration(seconds: 45));
    socket.push(
      'offer.new',
      _rawOffer(offerId: 'offer-1', deadlineAt: deadline.toIso8601String()),
    );
    await tester.pump();
    expect(container.read(incomingOfferControllerProvider)?.offerId, 'offer-1');

    socket.push('offer.revoked', {'offerId': 'offer-OTHER'});
    await tester.pump();

    expect(container.read(incomingOfferControllerProvider)?.offerId, 'offer-1');
    verifyNever(() => port.dismiss(any()));

    _disposeNow(container);
  });

  testWidgets(
    'offer.revoked с ТЕМ ЖЕ offerId чистит состояние и закрывает алерт',
    (tester) async {
      final container = _container(socket: socket, port: port);
      await tester.pump();

      final deadline = DateTime.now().add(const Duration(seconds: 45));
      socket.push(
        'offer.new',
        _rawOffer(offerId: 'offer-1', deadlineAt: deadline.toIso8601String()),
      );
      await tester.pump();

      socket.push('offer.revoked', {'offerId': 'offer-1'});
      await tester.pump();

      expect(container.read(incomingOfferControllerProvider), isNull);
      verify(() => port.dismiss('offer-1')).called(1);

      _disposeNow(container);
    },
  );

  testWidgets(
    'дедлайн истекает — состояние чистится само, без второго события',
    (tester) async {
      final container = _container(socket: socket, port: port);
      await tester.pump();

      final deadline = DateTime.now().add(const Duration(seconds: 10));
      socket.push(
        'offer.new',
        _rawOffer(deadlineAt: deadline.toIso8601String()),
      );
      await tester.pump();
      expect(container.read(incomingOfferControllerProvider), isNotNull);

      await tester.pump(const Duration(seconds: 9));
      expect(container.read(incomingOfferControllerProvider), isNotNull);

      await tester.pump(const Duration(seconds: 1));
      expect(container.read(incomingOfferControllerProvider), isNull);
      verify(() => port.dismiss('offer-1')).called(1);

      _disposeNow(container);
    },
  );
}
