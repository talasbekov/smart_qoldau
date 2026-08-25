// Юнит-тесты PayoutController (Step 1 брифа задачи 14 эпика E7):
// клиентская валидация (сумма/PAN/срок) раньше сети — requestPayout не
// вызывается вовсе, пока поля не пройдут проверку.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_expert/features/earnings/state/payout_controller.dart';

class MockSqApi extends Mock implements SqApi {}

const _validPan = '4111111111111111'; // проходит проверку Луна
const _validExpiry = '12/28';

ProviderContainer _container(SqApi api) {
  final container = ProviderContainer(overrides: [sqApiProvider.overrideWithValue(api)]);
  addTearDown(container.dispose);
  return container;
}

void main() {
  late MockSqApi api;

  setUp(() {
    api = MockSqApi();
  });

  test('amountTiyn: 0 не дёргает requestPayout вовсе', () async {
    final container = _container(api);
    final controller = container.read(payoutControllerProvider.notifier);

    await controller.submit(
      amountTiyn: 0,
      pan: _validPan,
      expiry: _validExpiry,
      holderName: 'Ivan Petrov',
    );

    verifyNever(
      () => api.requestPayout(
        amountTiyn: any(named: 'amountTiyn'),
        pan: any(named: 'pan'),
        expiry: any(named: 'expiry'),
        holderName: any(named: 'holderName'),
      ),
    );
    final state = container.read(payoutControllerProvider);
    expect(state.validationError, isNotNull);
    expect(state.submitting, isFalse);
  });

  test('невалидный PAN (не проходит Луна) не дёргает requestPayout', () async {
    final container = _container(api);
    final controller = container.read(payoutControllerProvider.notifier);

    await controller.submit(
      amountTiyn: 1000000,
      pan: '4111111111111112', // последняя цифра ломает контрольную сумму
      expiry: _validExpiry,
      holderName: 'Ivan Petrov',
    );

    verifyNever(
      () => api.requestPayout(
        amountTiyn: any(named: 'amountTiyn'),
        pan: any(named: 'pan'),
        expiry: any(named: 'expiry'),
        holderName: any(named: 'holderName'),
      ),
    );
    expect(container.read(payoutControllerProvider).validationError, isNotNull);
  });

  test('невалидный expiry не дёргает requestPayout', () async {
    final container = _container(api);
    final controller = container.read(payoutControllerProvider.notifier);

    await controller.submit(
      amountTiyn: 1000000,
      pan: _validPan,
      expiry: '13/28',
      holderName: 'Ivan Petrov',
    );

    verifyNever(
      () => api.requestPayout(
        amountTiyn: any(named: 'amountTiyn'),
        pan: any(named: 'pan'),
        expiry: any(named: 'expiry'),
        holderName: any(named: 'holderName'),
      ),
    );
    expect(container.read(payoutControllerProvider).validationError, isNotNull);
  });

  test('валидные поля вызывают requestPayout и кладут результат в состояние', () async {
    when(
      () => api.requestPayout(
        amountTiyn: 1000000,
        pan: _validPan,
        expiry: _validExpiry,
        holderName: 'Ivan Petrov',
      ),
    ).thenAnswer(
      (_) async => PayoutDto(
        id: 'payout-1',
        amountTiyn: 1000000,
        maskedPan: '**** 1111',
        status: PayoutStatus.processing,
        createdAt: DateTime.now(),
      ),
    );

    final container = _container(api);
    final controller = container.read(payoutControllerProvider.notifier);

    await controller.submit(
      amountTiyn: 1000000,
      pan: _validPan,
      expiry: _validExpiry,
      holderName: 'Ivan Petrov',
    );

    final state = container.read(payoutControllerProvider);
    expect(state.result?.status, PayoutStatus.processing);
    expect(state.validationError, isNull);
  });
}
