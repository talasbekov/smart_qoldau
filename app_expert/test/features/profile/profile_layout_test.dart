// Раскладка профиля эксперта (E14) по прототипу `Expert Web - Профиль`:
// карточка специалиста колонкой 280 px слева, настройки справа. На
// телефоне — прежний список.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

import 'package:shared_preferences/shared_preferences.dart';

import 'package:app_expert/core/locale_controller.dart';
import 'package:app_expert/features/home/state/home_controller.dart';
import 'package:app_expert/features/profile/ui/profile_screen.dart';
import 'package:app_expert/l10n/app_localizations.dart';

ExpertMe _me() => const ExpertMe(
  id: 'e1',
  displayName: 'Айгуль Сатпаева',
  city: 'Алматы',
  experience: ExperienceLevel.threeToFive,
  education: 'КазНУ',
  priceTiyn: 399000,
  languages: ['ru'],
  formats: [SessionFormat.video],
  topicSlugs: ['anxiety-stress'],
  verificationStatus: VerificationStatus.verified,
  workStatus: WorkStatus.accepting,
  isBlocked: false,
  acceptsUrgent: false,
  photoStatus: ProfileFieldStatus.approved,
  aboutStatus: ProfileFieldStatus.approved,
);

Future<void> _pumpAt(WidgetTester tester, Size size) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
        homeControllerProvider.overrideWith(() => _StubHomeController(_me())),
      ],
      child: MaterialApp(
        locale: const Locale('ru'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: const ProfileScreen(),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

class _StubHomeController extends HomeController {
  _StubHomeController(this._me);

  final ExpertMe _me;

  @override
  Future<ExpertMe> build() async => _me;
}

void main() {
  testWidgets('десктоп: карточка 280 px слева от настроек', (tester) async {
    await _pumpAt(tester, const Size(1440, 1024));

    final card = find.byKey(const Key('sq-profile-card'));
    expect(card, findsOneWidget);
    expect(tester.getSize(card).width, 280);
    expect(
      tester.getTopLeft(card).dx,
      lessThan(
        tester.getTopLeft(find.byKey(const Key('sq-profile-notifications'))).dx,
      ),
    );
  });

  testWidgets('телефон: карточка над настройками', (tester) async {
    await _pumpAt(tester, const Size(390, 844));

    expect(
      tester.getTopLeft(find.byKey(const Key('sq-profile-card'))).dy,
      lessThan(
        tester.getTopLeft(find.byKey(const Key('sq-profile-notifications'))).dy,
      ),
    );
  });

  testWidgets('статус верификации показан в карточке', (tester) async {
    await _pumpAt(tester, const Size(1440, 1024));
    expect(find.text('Верификация пройдена'), findsOneWidget);
  });
}
