// Юнит-тесты ExpertConsultationsController (Step 1 брифа задачи 12 эпика
// E7): три раздела («Заявки», «Идёт сейчас»/«Плановые», «История») грузятся
// НЕЗАВИСИМО — сбой одного не блокирует два остальных.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_expert/features/consultations/state/expert_consultations_controller.dart';

class MockSqApi extends Mock implements SqApi {}

OfferDto _offer() => OfferDto(
  offerId: 'offer-1',
  topicSlug: 'anxiety-stress',
  format: SessionFormat.video,
  isEmergency: true,
  clientCode: 4821,
  deadlineAt: DateTime(2026, 8, 25, 10, 15),
);

ConsultationExpertDto _consultation({
  required String id,
  required ConsultationStatus status,
  required DateTime startedAt,
}) => ConsultationExpertDto(
  id: id,
  status: status,
  format: SessionFormat.video,
  isEmergency: false,
  startedAt: startedAt,
  clientCode: 1234,
  topicSlug: 'anxiety-stress',
  priceTiyn: 500000,
  plannedDurationMin: 30,
  paymentStatus: ConsultationPaymentStatus.held,
);

ProviderContainer _container(SqApi api) {
  final container = ProviderContainer(
    overrides: [sqApiProvider.overrideWithValue(api)],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  setUpAll(() {
    registerFallbackValue(ConsultationStatus.active);
  });

  late MockSqApi api;

  setUp(() {
    api = MockSqApi();
  });

  test('три раздела грузятся независимо и попадают в состояние', () async {
    when(() => api.myOffers()).thenAnswer((_) async => [_offer()]);
    when(
      () => api.expertConsultations(status: ConsultationStatus.scheduled, take: null, skip: null),
    ).thenAnswer((_) async => []);
    when(
      () => api.expertConsultations(status: ConsultationStatus.active, take: null, skip: null),
    ).thenAnswer(
      (_) async => [
        _consultation(id: 'c1', status: ConsultationStatus.active, startedAt: DateTime(2026, 1, 1)),
      ],
    );
    when(
      () => api.expertConsultations(status: ConsultationStatus.completed, take: null, skip: null),
    ).thenAnswer(
      (_) async => [
        _consultation(id: 'c2', status: ConsultationStatus.completed, startedAt: DateTime(2026, 1, 2)),
      ],
    );
    when(
      () => api.expertConsultations(status: ConsultationStatus.cancelled, take: null, skip: null),
    ).thenAnswer((_) async => []);

    final container = _container(api);
    final controller = container.read(expertConsultationsControllerProvider.notifier);

    // build() запускает три раздела фоном (Future.microtask) — ждём их
    // завершения явно, а не полагаемся на порядок построения провайдера.
    await Future.wait([
      controller.refreshOffers(),
      controller.refreshActive(),
      controller.refreshHistory(),
    ]);

    final state = container.read(expertConsultationsControllerProvider);
    expect(state.offers.value, hasLength(1));
    expect(state.active.value!.single.id, 'c1');
    expect(state.history.value!.single.id, 'c2');
  });

  test('сбой ОДНОГО раздела (офферы) не блокирует два остальных', () async {
    when(() => api.myOffers()).thenThrow(
      const ApiException(ApiErrorCode.internal, 'сбой', 500),
    );
    when(
      () => api.expertConsultations(status: any(named: 'status'), take: null, skip: null),
    ).thenAnswer((_) async => []);

    final container = _container(api);
    final controller = container.read(expertConsultationsControllerProvider.notifier);

    await Future.wait([
      controller.refreshOffers(),
      controller.refreshActive(),
      controller.refreshHistory(),
    ]);

    final state = container.read(expertConsultationsControllerProvider);
    expect(state.offers.hasError, isTrue);
    expect(state.active.hasError, isFalse);
    expect(state.active.value, isEmpty);
    expect(state.history.hasError, isFalse);
    expect(state.history.value, isEmpty);
  });
}
