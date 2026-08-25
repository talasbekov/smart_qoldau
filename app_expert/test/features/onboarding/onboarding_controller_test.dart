// Юнит-тесты OnboardingController на моке SqApi (mocktail): успешный
// submit() кладёт ExpertMe в состояние; при EXPERT_EXISTS контроллер не
// пробрасывает исключение наружу, а сам вызывает me() и кладёт результат в
// состояние тем же путём (анкета уже есть с прошлой попытки — см. бриф
// задачи 4 плана E7).
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_expert/features/onboarding/state/onboarding_controller.dart';

class MockSqApi extends Mock implements SqApi {}

ExpertMe _expertMe({
  VerificationStatus verificationStatus = VerificationStatus.draft,
}) => ExpertMe(
  id: 'e1',
  displayName: 'Асель Ахметова',
  city: 'Алматы',
  experience: ExperienceLevel.threeToFive,
  education: 'КазНУ, психология',
  priceTiyn: 500000,
  languages: const ['ru', 'kk'],
  formats: const [SessionFormat.chat, SessionFormat.video],
  topicSlugs: const ['anxiety'],
  verificationStatus: verificationStatus,
  workStatus: WorkStatus.notAccepting,
  isBlocked: false,
  acceptsUrgent: false,
  photoStatus: ProfileFieldStatus.none,
  aboutStatus: ProfileFieldStatus.none,
);

ProviderContainer _makeContainer(SqApi api) {
  final container = ProviderContainer(
    overrides: [sqApiProvider.overrideWithValue(api)],
  );
  addTearDown(container.dispose);
  return container;
}

Future<void> _submit(ProviderContainer container) => container
    .read(onboardingControllerProvider.notifier)
    .submit(
      displayName: 'Асель Ахметова',
      city: 'Алматы',
      experience: ExperienceLevel.threeToFive,
      education: 'КазНУ, психология',
      priceTiyn: 500000,
      languages: const ['ru', 'kk'],
      formats: const [SessionFormat.chat, SessionFormat.video],
      topicSlugs: const ['anxiety'],
    );

void main() {
  setUpAll(() {
    registerFallbackValue(ExperienceLevel.threeToFive);
    registerFallbackValue(<String>[]);
    registerFallbackValue(<SessionFormat>[]);
  });

  group('OnboardingController.submit', () {
    test('успешный submit кладёт ExpertMe в состояние', () async {
      final api = MockSqApi();
      final expertMe = _expertMe();
      when(
        () => api.createExpert(
          displayName: any(named: 'displayName'),
          city: any(named: 'city'),
          experience: any(named: 'experience'),
          education: any(named: 'education'),
          priceTiyn: any(named: 'priceTiyn'),
          languages: any(named: 'languages'),
          formats: any(named: 'formats'),
          topicSlugs: any(named: 'topicSlugs'),
        ),
      ).thenAnswer((_) async => expertMe);
      final container = _makeContainer(api);

      await _submit(container);

      final state = container.read(onboardingControllerProvider).value;
      expect(state, expertMe);
      verifyNever(() => api.me());
    });

    test('при EXPERT_EXISTS не пробрасывает исключение, а вызывает me() и кладёт результат в состояние', () async {
      final api = MockSqApi();
      final existing = _expertMe(
        verificationStatus: VerificationStatus.pending,
      );
      when(
        () => api.createExpert(
          displayName: any(named: 'displayName'),
          city: any(named: 'city'),
          experience: any(named: 'experience'),
          education: any(named: 'education'),
          priceTiyn: any(named: 'priceTiyn'),
          languages: any(named: 'languages'),
          formats: any(named: 'formats'),
          topicSlugs: any(named: 'topicSlugs'),
        ),
      ).thenThrow(const ApiException(ApiErrorCode.expertExists, 'exists', 409));
      when(() => api.me()).thenAnswer((_) async => existing);
      final container = _makeContainer(api);

      await _submit(container);

      final state = container.read(onboardingControllerProvider);
      expect(state.hasError, isFalse);
      expect(state.value, existing);
      verify(() => api.me()).called(1);
    });

    test('при прочих ошибках API состояние переходит в AsyncError', () async {
      final api = MockSqApi();
      when(
        () => api.createExpert(
          displayName: any(named: 'displayName'),
          city: any(named: 'city'),
          experience: any(named: 'experience'),
          education: any(named: 'education'),
          priceTiyn: any(named: 'priceTiyn'),
          languages: any(named: 'languages'),
          formats: any(named: 'formats'),
          topicSlugs: any(named: 'topicSlugs'),
        ),
      ).thenThrow(
        const ApiException(
          ApiErrorCode.priceOutOfRange,
          'price out of range',
          400,
        ),
      );
      final container = _makeContainer(api);

      await _submit(container);

      final state = container.read(onboardingControllerProvider);
      expect(state.hasError, isTrue);
      expect(
        state.error,
        isA<ApiException>().having(
          (e) => e.code,
          'code',
          ApiErrorCode.priceOutOfRange,
        ),
      );
    });
  });
}
