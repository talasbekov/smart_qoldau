// Юнит-тесты ScheduleController (E7 задача 8): toggleDay переключает
// enabled только у целевого дня, не трогая остальные шесть; save() шлёт
// updateSchedule с ПОЛНЫМ текущим массивом из 7 дней (контракт —
// полная замена, не патч по дню); клиентская валидация endMin<=startMin
// блокирует сетевой вызов (тот же приём, что ArgumentError в
// SqApiSchedule, задача 7).
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_expert/features/schedule/state/schedule_controller.dart';

class MockSqApi extends Mock implements SqApi {}

ScheduleDay _day(
  int weekday, {
  bool enabled = true,
  int? startMin = 540,
  int? endMin = 1080,
  int? breakStart,
  int? breakEnd,
}) => ScheduleDay(
  weekday: weekday,
  enabled: enabled,
  startMin: startMin,
  endMin: endMin,
  breakStart: breakStart,
  breakEnd: breakEnd,
);

List<ScheduleDay> _week() => [for (var i = 0; i < 7; i++) _day(i)];

ProviderContainer _makeContainer(SqApi api) {
  final container = ProviderContainer(
    overrides: [sqApiProvider.overrideWithValue(api)],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  group('ScheduleController.toggleDay', () {
    test(
      'переключает enabled только у целевого дня, остальные не тронуты',
      () async {
        final api = MockSqApi();
        when(() => api.schedule()).thenAnswer((_) async => _week());
        final container = _makeContainer(api);
        final controller = container.read(scheduleControllerProvider.notifier);
        await container.read(scheduleControllerProvider.future);

        controller.toggleDay(2);

        final days = container.read(scheduleControllerProvider).value!;
        expect(days[2].enabled, isFalse);
        for (var i = 0; i < 7; i++) {
          if (i == 2) continue;
          expect(
            days[i].enabled,
            isTrue,
            reason: 'день $i не должен был измениться',
          );
          expect(
            days[i].startMin,
            540,
            reason: 'день $i не должен был измениться',
          );
          expect(
            days[i].endMin,
            1080,
            reason: 'день $i не должен был измениться',
          );
        }
      },
    );
  });

  group('ScheduleController.save', () {
    test(
      'шлёт updateSchedule с полным массивом из 7 дней, а не только изменённым',
      () async {
        final api = MockSqApi();
        when(() => api.schedule()).thenAnswer((_) async => _week());
        when(() => api.updateSchedule(any())).thenAnswer(
          (invocation) async =>
              invocation.positionalArguments[0] as List<ScheduleDay>,
        );
        final container = _makeContainer(api);
        final controller = container.read(scheduleControllerProvider.notifier);
        await container.read(scheduleControllerProvider.future);

        controller.toggleDay(3);
        await controller.save();

        final captured =
            verify(() => api.updateSchedule(captureAny())).captured.single
                as List<ScheduleDay>;
        expect(captured.length, 7);
        expect(captured[3].enabled, isFalse);
        for (var i = 0; i < 7; i++) {
          if (i == 3) continue;
          expect(captured[i].enabled, isTrue);
        }
      },
    );

    test(
      'endMin<=startMin блокирует сетевой вызов — локальная ошибка валидации',
      () async {
        final api = MockSqApi();
        when(() => api.schedule()).thenAnswer((_) async => _week());
        final container = _makeContainer(api);
        final controller = container.read(scheduleControllerProvider.notifier);
        await container.read(scheduleControllerProvider.future);

        controller.setHours(0, startMin: 600, endMin: 600);

        await expectLater(
          () => controller.save(),
          throwsA(isA<ScheduleValidationException>()),
        );
        verifyNever(() => api.updateSchedule(any()));
      },
    );
  });
}
