// Юнит-тесты ConsultationsController (Step 1 брифа задачи 17): склейка
// истории из двух запросов, живое применение событий, отмена в гонке,
// пагинация и удаление своего отзыва.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:app_client/core/locale_controller.dart';
import 'package:app_client/core/providers.dart';
import 'package:app_client/features/consultations/data/consultations_repository.dart';
import 'package:app_client/features/consultations/state/consultations_controller.dart';
import 'package:app_client/features/review/state/review_controller.dart';

class MockSqApi extends Mock implements SqApi {}

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

ExpertPublic _expert() => const ExpertPublic(
  id: 'e1',
  displayName: 'Динара С.',
  city: 'Алматы',
  experience: ExperienceLevel.threeToFive,
  priceTiyn: 399000,
  languages: ['ru'],
  formats: [SessionFormat.chat],
  topicSlugs: ['anxiety-stress'],
  workStatus: WorkStatus.accepting,
  ratingAvg: 4.9,
  ratingCount: 312,
);

ClientConsultation _consultation(
  String id, {
  required ConsultationStatus status,
  required DateTime startedAt,
  ConsultationPaymentStatus payment = ConsultationPaymentStatus.held,
}) => ClientConsultation(
  id: id,
  status: status,
  format: SessionFormat.chat,
  isEmergency: false,
  startedAt: startedAt,
  priceTiyn: 399000,
  plannedDurationMin: 50,
  paymentStatus: payment,
  expert: _expert(),
);

Future<ProviderContainer> _container({
  required SqApi api,
  required SqSocket socket,
  Map<String, Object> prefsValues = const {},
}) async {
  SharedPreferences.setMockInitialValues(prefsValues);
  final prefs = await SharedPreferences.getInstance();
  final container = ProviderContainer(
    overrides: [
      sqApiProvider.overrideWithValue(api),
      sqEventsProvider.overrideWithValue(SqEvents(socket)),
      sharedPreferencesProvider.overrideWithValue(prefs),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  setUpAll(() => registerFallbackValue(ConsultationStatus.active));

  late MockSqApi api;
  late _FakeSqSocket socket;

  setUp(() {
    api = MockSqApi();
    socket = _FakeSqSocket();
    addTearDown(socket.dispose);
    // По умолчанию плановых записей нет — тесты ниже про ACTIVE.
    when(
      () => api.consultations(
        status: ConsultationStatus.scheduled,
        take: any(named: 'take'),
        skip: any(named: 'skip'),
      ),
    ).thenAnswer((_) async => []);
  });

  test('активная вкладка запрашивает и SCHEDULED, и ACTIVE', () async {
    // Плановая запись и идущая консультация для клиента — одно и то же
    // «предстоит», поэтому вкладка тянет оба статуса (E6b).
    when(
      () => api.consultations(
        status: ConsultationStatus.scheduled,
        take: any(named: 'take'),
        skip: any(named: 'skip'),
      ),
    ).thenAnswer(
      (_) async => [
        _consultation(
          'c0',
          status: ConsultationStatus.scheduled,
          startedAt: DateTime(2026, 8, 25, 15),
        ),
      ],
    );
    when(
      () => api.consultations(
        status: ConsultationStatus.active,
        take: any(named: 'take'),
        skip: any(named: 'skip'),
      ),
    ).thenAnswer(
      (_) async => [
        _consultation(
          'c1',
          status: ConsultationStatus.active,
          startedAt: DateTime(2026, 8, 22, 10),
        ),
      ],
    );

    final container = await _container(api: api, socket: socket);
    container.listen(
      consultationsControllerProvider(ConsultationsTab.active),
      (previous, next) {},
      fireImmediately: true,
    );
    final list = await container.read(
      consultationsControllerProvider(ConsultationsTab.active).future,
    );

    // Ближайшая по времени плановая идёт первой — список активной вкладки
    // отсортирован по началу.
    expect(list.map((c) => c.id), ['c0', 'c1']);
    verifyNever(
      () => api.consultations(
        status: ConsultationStatus.completed,
        take: any(named: 'take'),
        skip: any(named: 'skip'),
      ),
    );
  });

  test('история склеивает два запроса и сортирует по началу убыв.', () async {
    when(
      () => api.consultations(
        status: ConsultationStatus.completed,
        take: any(named: 'take'),
        skip: any(named: 'skip'),
      ),
    ).thenAnswer(
      (_) async => [
        _consultation(
          'старая',
          status: ConsultationStatus.completed,
          startedAt: DateTime(2026, 8, 1),
        ),
        _consultation(
          'свежая',
          status: ConsultationStatus.completed,
          startedAt: DateTime(2026, 8, 20),
        ),
      ],
    );
    when(
      () => api.consultations(
        status: ConsultationStatus.cancelled,
        take: any(named: 'take'),
        skip: any(named: 'skip'),
      ),
    ).thenAnswer(
      (_) async => [
        _consultation(
          'отменённая',
          status: ConsultationStatus.cancelled,
          startedAt: DateTime(2026, 8, 10),
        ),
      ],
    );

    final container = await _container(api: api, socket: socket);
    container.listen(
      consultationsControllerProvider(ConsultationsTab.history),
      (previous, next) {},
      fireImmediately: true,
    );
    final list = await container.read(
      consultationsControllerProvider(ConsultationsTab.history).future,
    );

    expect(list.map((c) => c.id), ['свежая', 'отменённая', 'старая']);
  });

  test('пагинация дописывает вторую страницу без дублей', () async {
    when(
      () => api.consultations(
        status: ConsultationStatus.active,
        take: any(named: 'take'),
        skip: 0,
      ),
    ).thenAnswer(
      (_) async => [
        _consultation(
          'c1',
          status: ConsultationStatus.active,
          startedAt: DateTime(2026, 8, 22, 10),
        ),
      ],
    );
    when(
      () => api.consultations(
        status: ConsultationStatus.active,
        take: any(named: 'take'),
        skip: 1,
      ),
    ).thenAnswer(
      (_) async => [
        _consultation(
          'c1',
          status: ConsultationStatus.active,
          startedAt: DateTime(2026, 8, 22, 10),
        ),
        _consultation(
          'c2',
          status: ConsultationStatus.active,
          startedAt: DateTime(2026, 8, 21, 10),
        ),
      ],
    );

    final container = await _container(api: api, socket: socket);
    final provider = consultationsControllerProvider(ConsultationsTab.active);
    container.listen(provider, (previous, next) {}, fireImmediately: true);
    await container.read(provider.future);

    await container.read(provider.notifier).loadMore();

    expect(container.read(provider).requireValue.map((c) => c.id), [
      'c1',
      'c2',
    ]);
  });

  test('событие о смене оплаты правит карточку на месте, без перезапроса', () async {
    when(
      () => api.consultations(
        status: ConsultationStatus.active,
        take: any(named: 'take'),
        skip: any(named: 'skip'),
      ),
    ).thenAnswer(
      (_) async => [
        _consultation(
          'c1',
          status: ConsultationStatus.active,
          startedAt: DateTime(2026, 8, 22, 10),
          payment: ConsultationPaymentStatus.held,
        ),
      ],
    );

    final container = await _container(api: api, socket: socket);
    final provider = consultationsControllerProvider(ConsultationsTab.active);
    container.listen(provider, (previous, next) {}, fireImmediately: true);
    await container.read(provider.future);

    socket.push('consultation.updated', {
      'id': 'c1',
      'paymentStatus': 'CAPTURED',
    });
    await Future<void>.delayed(Duration.zero);

    expect(
      container.read(provider).requireValue.single.paymentStatus,
      ConsultationPaymentStatus.captured,
    );
    // Ровно один круг сети на статус вкладки и ни одного лишнего после
    // события: два вызова — это SCHEDULED и ACTIVE первой загрузки.
    verify(
      () => api.consultations(
        status: any(named: 'status'),
        take: any(named: 'take'),
        skip: any(named: 'skip'),
      ),
    ).called(2);
  });

  test('отмена в гонке (409 CONSULTATION_NOT_ACTIVE) не роняет экран', () async {
    var calls = 0;
    when(
      () => api.consultations(
        status: ConsultationStatus.active,
        take: any(named: 'take'),
        skip: any(named: 'skip'),
      ),
    ).thenAnswer((_) async {
      calls++;
      return calls == 1
          ? [
              _consultation(
                'c1',
                status: ConsultationStatus.active,
                startedAt: DateTime(2026, 8, 22, 10),
              ),
            ]
          : <ClientConsultation>[];
    });
    when(() => api.cancelConsultation('c1')).thenAnswer(
      (_) async => throw const ApiException(
        ApiErrorCode.consultationNotActive,
        'not active',
        409,
      ),
    );

    final container = await _container(api: api, socket: socket);
    final provider = consultationsControllerProvider(ConsultationsTab.active);
    container.listen(provider, (previous, next) {}, fireImmediately: true);
    await container.read(provider.future);

    await container.read(provider.notifier).cancel('c1');

    expect(container.read(provider).hasError, isFalse);
    expect(container.read(provider).requireValue, isEmpty);
    expect(calls, 2, reason: 'список должен быть перечитан');
  });

  test('reviewId берётся из DTO, а не из локальной памяти', () async {
    // После переустановки приложения локальной записи нет, а отзыв есть —
    // раньше кнопка «Удалить отзыв» в этом случае просто не появлялась.
    when(() => api.consultationById('c1')).thenAnswer(
      (_) async => _consultation(
        'c1',
        status: ConsultationStatus.completed,
        startedAt: DateTime(2026, 8, 22, 10),
      ).copyWith(reviewId: 'rev-from-server'),
    );
    when(() => api.deleteReview('rev-from-server')).thenAnswer((_) async {});

    final container = await _container(api: api, socket: socket);

    // Провайдер консультации — источник reviewId.
    await container.read(consultationProvider('c1').future);
    expect(
      container.read(myReviewControllerProvider('c1')).reviewId,
      'rev-from-server',
    );

    await container.read(myReviewControllerProvider('c1').notifier).delete();
    verify(() => api.deleteReview('rev-from-server')).called(1);
  });

  test('удаление отзыва снимает локальный флаг оценки', () async {
    when(() => api.deleteReview('rev-1')).thenAnswer((_) async {});
    when(
      () => api.consultations(
        status: any(named: 'status'),
        take: any(named: 'take'),
        skip: any(named: 'skip'),
      ),
    ).thenAnswer((_) async => []);

    final container = await _container(
      api: api,
      socket: socket,
      prefsValues: {'sq.reviewed.c1': true, 'sq.reviewId.c1': 'rev-1'},
    );

    await container.read(myReviewControllerProvider('c1').notifier).delete();

    final prefs = container.read(sharedPreferencesProvider);
    expect(prefs.getBool(reviewedFlagKey('c1')), isNull);
    expect(prefs.getString(reviewIdKey('c1')), isNull);
    verify(() => api.deleteReview('rev-1')).called(1);
  });

  test('REVIEW_NOT_FOUND при удалении тоже снимает флаг и не ошибка', () async {
    // Отзыв уже удалён (например, модерацией) — оставлять локальный флаг
    // значило бы навсегда запретить клиенту оценить консультацию.
    when(() => api.deleteReview('rev-1')).thenAnswer(
      (_) async => throw const ApiException(
        ApiErrorCode.reviewNotFound,
        'not found',
        404,
      ),
    );

    final container = await _container(
      api: api,
      socket: socket,
      prefsValues: {'sq.reviewed.c1': true, 'sq.reviewId.c1': 'rev-1'},
    );

    await container.read(myReviewControllerProvider('c1').notifier).delete();

    final prefs = container.read(sharedPreferencesProvider);
    expect(prefs.getBool(reviewedFlagKey('c1')), isNull);
    expect(
      container.read(myReviewControllerProvider('c1')).errorCode,
      isNull,
    );
  });

  test('сбой сети при удалении отзыва флаг НЕ снимает', () async {
    when(() => api.deleteReview('rev-1')).thenAnswer(
      (_) async => throw const ApiException(ApiErrorCode.network, 'нет сети', 0),
    );

    final container = await _container(
      api: api,
      socket: socket,
      prefsValues: {'sq.reviewed.c1': true, 'sq.reviewId.c1': 'rev-1'},
    );

    await container.read(myReviewControllerProvider('c1').notifier).delete();

    final prefs = container.read(sharedPreferencesProvider);
    expect(prefs.getBool(reviewedFlagKey('c1')), isTrue);
    expect(
      container.read(myReviewControllerProvider('c1')).errorCode,
      ApiErrorCode.network,
    );
  });
}
