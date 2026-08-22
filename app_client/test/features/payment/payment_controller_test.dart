// Юнит-тесты PaymentController (Step 1 брифа задачи 12): холд, отказ
// провайдера, идемпотентный повтор и защита от двойного холда.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_client/core/providers.dart';
import 'package:app_client/features/payment/state/payment_controller.dart';

class MockSqApi extends Mock implements SqApi {}

ProviderContainer _container(SqApi api) {
  final container = ProviderContainer(
    overrides: [sqApiProvider.overrideWithValue(api)],
  );
  addTearDown(container.dispose);
  container.listen(
    paymentControllerProvider,
    (previous, next) {},
    fireImmediately: true,
  );
  return container;
}

void main() {
  late MockSqApi api;

  setUp(() {
    api = MockSqApi();
  });

  test('HELD переводит в paid', () async {
    when(
      () => api.payConsultation('c1', paymentMethodId: 'pm1'),
    ).thenAnswer((_) async => const PayResult(status: PaymentStatus.held));

    final container = _container(api);
    await container
        .read(paymentControllerProvider.notifier)
        .pay(consultationId: 'c1', paymentMethodId: 'pm1');

    expect(container.read(paymentControllerProvider).phase, PaymentPhase.paid);
  });

  test('PROVIDER_DECLINED даёт declined с сообщением провайдера', () async {
    when(() => api.payConsultation('c1', paymentMethodId: 'pm1')).thenThrow(
      const ApiException(
        ApiErrorCode.providerDeclined,
        'Недостаточно средств',
        402,
      ),
    );

    final container = _container(api);
    await container
        .read(paymentControllerProvider.notifier)
        .pay(consultationId: 'c1', paymentMethodId: 'pm1');

    final state = container.read(paymentControllerProvider);
    expect(state.phase, PaymentPhase.declined);
    expect(state.providerMessage, 'Недостаточно средств');
  });

  test('ALREADY_PAID трактуется как успешная оплата', () async {
    // Идемпотентный повтор: ответ первой попытки потерялся, деньги уже
    // захолдированы — уводить клиента в ошибку означало бы заставить его
    // платить дважды.
    when(() => api.payConsultation('c1', paymentMethodId: 'pm1')).thenThrow(
      const ApiException(ApiErrorCode.alreadyPaid, 'already paid', 409),
    );

    final container = _container(api);
    await container
        .read(paymentControllerProvider.notifier)
        .pay(consultationId: 'c1', paymentMethodId: 'pm1');

    expect(container.read(paymentControllerProvider).phase, PaymentPhase.paid);
  });

  test('повторное нажатие во время запроса не шлёт второй холд', () async {
    final gate = Completer<void>();
    var calls = 0;
    when(() => api.payConsultation('c1', paymentMethodId: 'pm1')).thenAnswer((
      _,
    ) async {
      calls++;
      await gate.future;
      return const PayResult(status: PaymentStatus.held);
    });

    final container = _container(api);
    final notifier = container.read(paymentControllerProvider.notifier);

    final first = notifier.pay(consultationId: 'c1', paymentMethodId: 'pm1');
    final second = notifier.pay(consultationId: 'c1', paymentMethodId: 'pm1');
    gate.complete();
    await Future.wait([first, second]);

    expect(calls, 1, reason: 'двойной холд списал бы деньги дважды');
    expect(container.read(paymentControllerProvider).phase, PaymentPhase.paid);
  });

  test('PAYMENT_METHOD_NOT_FOUND просит обновить карты', () async {
    when(() => api.payConsultation('c1', paymentMethodId: 'pm-gone')).thenThrow(
      const ApiException(
        ApiErrorCode.paymentMethodNotFound,
        'not found',
        404,
      ),
    );

    final container = _container(api);
    await container
        .read(paymentControllerProvider.notifier)
        .pay(consultationId: 'c1', paymentMethodId: 'pm-gone');

    final state = container.read(paymentControllerProvider);
    expect(state.phase, PaymentPhase.declined);
    expect(state.errorCode, ApiErrorCode.paymentMethodNotFound);
    expect(
      state.cardsStale,
      isTrue,
      reason: 'карта исчезла на бэкенде — список нужно перечитать',
    );
  });

  test('прочая ошибка не выдаётся за успешную оплату', () async {
    when(() => api.payConsultation('c1', paymentMethodId: 'pm1')).thenThrow(
      const ApiException(ApiErrorCode.network, 'нет сети', 0),
    );

    final container = _container(api);
    await container
        .read(paymentControllerProvider.notifier)
        .pay(consultationId: 'c1', paymentMethodId: 'pm1');

    final state = container.read(paymentControllerProvider);
    expect(state.phase, PaymentPhase.declined);
    expect(state.errorCode, ApiErrorCode.network);
    expect(state.providerMessage, isNull);
  });

  test('после отказа можно повторить — состояние не залипает', () async {
    var attempt = 0;
    when(() => api.payConsultation('c1', paymentMethodId: 'pm1')).thenAnswer((
      _,
    ) async {
      attempt++;
      if (attempt == 1) {
        throw const ApiException(
          ApiErrorCode.providerDeclined,
          'Недостаточно средств',
          402,
        );
      }
      return const PayResult(status: PaymentStatus.held);
    });

    final container = _container(api);
    final notifier = container.read(paymentControllerProvider.notifier);

    await notifier.pay(consultationId: 'c1', paymentMethodId: 'pm1');
    expect(
      container.read(paymentControllerProvider).phase,
      PaymentPhase.declined,
    );

    await notifier.pay(consultationId: 'c1', paymentMethodId: 'pm1');
    expect(container.read(paymentControllerProvider).phase, PaymentPhase.paid);
    expect(attempt, 2);
  });
}
