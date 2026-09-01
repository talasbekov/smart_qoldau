// Юнит-тесты HomeController (Step 1/2 брифа задачи 10 эпика E7): heartbeat
// раз в 20 с, только пока workStatus == ACCEPTING, и попытка включить приём
// без VERIFIED не должна дёргать сеть вовсе.
//
// Контроллер использует настоящий `Timer.periodic` — тесты живут в
// `testWidgets`, а таймер проверяется виртуальным временем `tester.pump`
// (см. `search_controller_test.dart` в `app_client`, урок 3 плана эпика E6).
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_expert/features/home/state/home_controller.dart';

class MockSqApi extends Mock implements SqApi {}

ExpertMe _me({
  WorkStatus workStatus = WorkStatus.accepting,
  VerificationStatus verificationStatus = VerificationStatus.verified,
}) => ExpertMe(
  id: 'e1',
  displayName: 'Айгуль Т.',
  city: 'Алматы',
  experience: ExperienceLevel.oneToThree,
  education: 'КазНУ',
  priceTiyn: 500000,
  languages: const ['ru'],
  formats: const [SessionFormat.chat],
  topicSlugs: const ['anxiety-stress'],
  verificationStatus: verificationStatus,
  workStatus: workStatus,
  isBlocked: false,
  acceptsUrgent: false,
  photoStatus: ProfileFieldStatus.none,
  aboutStatus: ProfileFieldStatus.none,
);

ProviderContainer _container(SqApi api) {
  final container = ProviderContainer(
    overrides: [sqApiProvider.overrideWithValue(api)],
  );
  addTearDown(container.dispose);
  container.listen(
    homeControllerProvider,
    (previous, next) {},
    fireImmediately: true,
  );
  return container;
}

/// Утилизирует контейнер прямо в теле теста: пока живёт провайдер, живёт и
/// его `Timer.periodic`, а `flutter_test` считает незакрытый таймер утечкой
/// ещё до tearDown.
void _disposeNow(ProviderContainer container) => container.dispose();

void main() {
  late MockSqApi api;

  setUp(() {
    api = MockSqApi();
    registerFallbackValue(WorkStatus.accepting);
  });

  testWidgets('workStatus ACCEPTING: heartbeat вызывается раз в 20 с', (
    tester,
  ) async {
    when(() => api.me())
        .thenAnswer((_) async => _me(workStatus: WorkStatus.accepting));
    var heartbeats = 0;
    when(() => api.heartbeat()).thenAnswer((_) async => heartbeats++);

    final container = _container(api);
    await tester.pump();
    expect(heartbeats, 0);

    await tester.pump(const Duration(seconds: 19));
    expect(heartbeats, 0);

    await tester.pump(const Duration(seconds: 1));
    expect(heartbeats, 1);

    await tester.pump(const Duration(seconds: 20));
    expect(heartbeats, 2);

    _disposeNow(container);
  });

  testWidgets('workStatus NOT_ACCEPTING: heartbeat не вызывается вовсе', (
    tester,
  ) async {
    when(() => api.me())
        .thenAnswer((_) async => _me(workStatus: WorkStatus.notAccepting));
    var heartbeats = 0;
    when(() => api.heartbeat()).thenAnswer((_) async => heartbeats++);

    final container = _container(api);
    await tester.pump();

    await tester.pump(const Duration(seconds: 60));
    expect(heartbeats, 0);

    _disposeNow(container);
  });

  testWidgets(
    'переключение на NOT_ACCEPTING останавливает heartbeat навсегда',
    (tester) async {
      when(() => api.me())
          .thenAnswer((_) async => _me(workStatus: WorkStatus.accepting));
      var heartbeats = 0;
      when(() => api.heartbeat()).thenAnswer((_) async => heartbeats++);
      when(() => api.setWorkStatus(WorkStatus.notAccepting))
          .thenAnswer((_) async => _me(workStatus: WorkStatus.notAccepting));

      final container = _container(api);
      await tester.pump();

      await tester.pump(const Duration(seconds: 20));
      expect(heartbeats, 1);

      await container
          .read(homeControllerProvider.notifier)
          .setStatus(WorkStatus.notAccepting);
      await tester.pump();

      await tester.pump(const Duration(seconds: 60));
      expect(
        heartbeats,
        1,
        reason: 'таймер должен быть отменён, а не просто игнорировать статус',
      );

      _disposeNow(container);
    },
  );

  testWidgets(
    'setStatus(accepting) при verificationStatus != VERIFIED не вызывает setWorkStatus вовсе',
    (tester) async {
      when(() => api.me()).thenAnswer(
        (_) async => _me(
          workStatus: WorkStatus.notAccepting,
          verificationStatus: VerificationStatus.pending,
        ),
      );

      final container = _container(api);
      await tester.pump();

      await expectLater(
        container
            .read(homeControllerProvider.notifier)
            .setStatus(WorkStatus.accepting),
        throwsA(
          isA<ApiException>().having(
            (e) => e.code,
            'code',
            ApiErrorCode.notVerified,
          ),
        ),
      );

      verifyNever(() => api.setWorkStatus(any()));

      _disposeNow(container);
    },
  );

  testWidgets(
    'setStatus(accepting) при VERIFIED вызывает setWorkStatus и запускает heartbeat',
    (tester) async {
      when(() => api.me()).thenAnswer(
        (_) async => _me(
          workStatus: WorkStatus.notAccepting,
          verificationStatus: VerificationStatus.verified,
        ),
      );
      var heartbeats = 0;
      when(() => api.heartbeat()).thenAnswer((_) async => heartbeats++);
      when(() => api.setWorkStatus(WorkStatus.accepting))
          .thenAnswer((_) async => _me(workStatus: WorkStatus.accepting));

      final container = _container(api);
      await tester.pump();

      await container
          .read(homeControllerProvider.notifier)
          .setStatus(WorkStatus.accepting);
      await tester.pump();

      await tester.pump(const Duration(seconds: 20));
      expect(heartbeats, 1);

      _disposeNow(container);
    },
  );
}
