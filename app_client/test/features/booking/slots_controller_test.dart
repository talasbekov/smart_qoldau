// Слоты для записи (E6b, задача 8): загрузка горизонта одним запросом и
// группировка по дням в зоне Алматы — слот 04:00 UTC принадлежит 25 августа
// как 09:00 утра, а не 25-му «по UTC» случайно.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_client/core/providers.dart';
import 'package:app_client/features/booking/state/slots_controller.dart';

class MockSqApi extends Mock implements SqApi {}

final _now = DateTime.utc(2026, 8, 24, 3); // 08:00 Алматы

ProviderContainer _container(SqApi api) {
  final container = ProviderContainer(
    overrides: [
      sqApiProvider.overrideWithValue(api),
      nowProvider.overrideWithValue(() => _now),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  late MockSqApi api;

  setUp(() {
    api = MockSqApi();
  });

  test('горизонт запрашивается одним вызовом, слоты группируются по дням Алматы', () async {
    when(
      () => api.slots('e1', from: any(named: 'from'), to: any(named: 'to')),
    ).thenAnswer(
      (_) async => [
        // 09:00 и 10:00 по Алматы 25 августа.
        Slot(startAt: DateTime.utc(2026, 8, 25, 4)),
        Slot(startAt: DateTime.utc(2026, 8, 25, 5)),
        // 09:00 по Алматы 26 августа.
        Slot(startAt: DateTime.utc(2026, 8, 26, 4)),
      ],
    );

    final container = _container(api);
    final state = await container.read(slotsControllerProvider('e1').future);

    verify(
      () => api.slots('e1', from: any(named: 'from'), to: any(named: 'to')),
    ).called(1);
    expect(state.days, hasLength(14));
    expect(state.slotsOn(DateTime.utc(2026, 8, 25)), hasLength(2));
    expect(state.slotsOn(DateTime.utc(2026, 8, 26)), hasLength(1));
    // Пустые дни видны как пустые, а не отсутствуют.
    expect(state.slotsOn(DateTime.utc(2026, 8, 27)), isEmpty);
    expect(state.hasSlotsOn(DateTime.utc(2026, 8, 27)), isFalse);
    expect(state.hasSlotsOn(DateTime.utc(2026, 8, 25)), isTrue);
  });

  test('слот у границы суток попадает в свой день по Алматы', () async {
    when(
      () => api.slots('e1', from: any(named: 'from'), to: any(named: 'to')),
    ).thenAnswer(
      (_) async => [
        // 19:00 UTC = 00:00 следующего дня по Алматы.
        Slot(startAt: DateTime.utc(2026, 8, 25, 19)),
      ],
    );

    final container = _container(api);
    final state = await container.read(slotsControllerProvider('e1').future);

    expect(state.slotsOn(DateTime.utc(2026, 8, 25)), isEmpty);
    expect(state.slotsOn(DateTime.utc(2026, 8, 26)), hasLength(1));
  });

  test('ошибка сети даёт состояние ошибки, повтор перезапрашивает', () async {
    var calls = 0;
    when(
      () => api.slots('e1', from: any(named: 'from'), to: any(named: 'to')),
    ).thenAnswer((_) async {
      calls++;
      if (calls == 1) {
        throw const ApiException('NETWORK', 'нет сети', 0);
      }
      return [Slot(startAt: DateTime.utc(2026, 8, 25, 4))];
    });

    final container = _container(api);
    await expectLater(
      container.read(slotsControllerProvider('e1').future),
      throwsA(isA<ApiException>()),
    );

    container.invalidate(slotsControllerProvider('e1'));
    final state = await container.read(slotsControllerProvider('e1').future);
    expect(state.slotsOn(DateTime.utc(2026, 8, 25)), hasLength(1));
    expect(calls, 2);
  });
}
