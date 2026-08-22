// Виджет-тесты WelcomeScreen: точки входа для неавторизованного
// пользователя (БП-10 шаг 1–2). Ревью раунда 1 задачи 6 потребовало
// отдельного покрытия — на этом экране живёт нормативное требование о
// равноправии анонимного входа, плюс нетривиальная асинхронная логика
// (гостевой вход, обработка ApiException, блокировка кнопок на время
// запроса, две ссылки на url_launcher), ничего из которой `dart analyze`
// не ловит.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_client/core/legal_links.dart';
import 'package:app_client/core/providers.dart';
import 'package:app_client/core/token_store.dart';
import 'package:app_client/core/url_launcher_port.dart';
import 'package:app_client/features/auth/ui/phone_screen.dart';
import 'package:app_client/features/onboarding/ui/welcome_screen.dart';
import 'package:app_client/l10n/app_localizations.dart';

class MockSqApi extends Mock implements SqApi {}

class _FakeSecureStore implements SecureStore {
  final Map<String, String> data = {};

  @override
  Future<String?> read(String key) async => data[key];

  @override
  Future<void> write(String key, String value) async => data[key] = value;

  @override
  Future<void> delete(String key) async => data.remove(key);
}

class _FakeUrlLauncherPort implements UrlLauncherPort {
  final List<String> launched = [];

  @override
  Future<void> launch(String url) async => launched.add(url);
}

Tokens _guestTokens() => const Tokens(
  accessToken: 'access',
  refreshToken: 'refresh',
  user: AuthUser(id: 'guest-1', phone: null, isGuest: true),
);

Widget _wrap(SqApi api, {UrlLauncherPort? urlLauncher}) {
  return ProviderScope(
    overrides: [
      sqApiProvider.overrideWithValue(api),
      secureStoreProvider.overrideWithValue(_FakeSecureStore()),
      urlLauncherPortProvider.overrideWithValue(
        urlLauncher ?? _FakeUrlLauncherPort(),
      ),
    ],
    child: MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: const WelcomeScreen(),
    ),
  );
}

final _phoneButtonKey = find.byKey(const Key('sq-welcome-phone-button'));
final _guestButtonKey = find.byKey(const Key('sq-welcome-guest-button'));

void main() {
  setUpAll(() {
    registerFallbackValue('device-id');
  });

  testWidgets(
    'обе кнопки — SqButton одинакового отрисованного размера, в порядке телефон → аноним',
    (tester) async {
      await tester.pumpWidget(_wrap(MockSqApi()));

      expect(find.byType(SqButton), findsNWidgets(2));

      final l10n = AppLocalizations.of(
        tester.element(find.byType(WelcomeScreen)),
      )!;
      final phoneWidget = tester.widget<SqButton>(_phoneButtonKey);
      final guestWidget = tester.widget<SqButton>(_guestButtonKey);
      expect(phoneWidget.label, l10n.actionLoginByPhone);
      expect(guestWidget.label, l10n.actionContinueAnonymously);

      // Смысл требования БП-10 — анонимная кнопка не может оказаться
      // меньше телефонной, поэтому сравниваем фактические отрисованные
      // размеры, а не просто наличие обоих виджетов.
      expect(tester.getSize(_phoneButtonKey), tester.getSize(_guestButtonKey));

      // Порядок: телефонная кнопка выше анонимной в разметке.
      expect(
        tester.getTopLeft(_phoneButtonKey).dy,
        lessThan(tester.getTopLeft(_guestButtonKey).dy),
      );
    },
  );

  testWidgets('тап "Войти по номеру" открывает PhoneScreen', (tester) async {
    await tester.pumpWidget(_wrap(MockSqApi()));

    await tester.tap(_phoneButtonKey);
    await tester.pumpAndSettle();

    expect(find.byType(PhoneScreen), findsOneWidget);
  });

  testWidgets(
    'тап "Продолжить анонимно" вызывает гостевой вход ровно один раз и блокирует обе кнопки на время запроса',
    (tester) async {
      final api = MockSqApi();
      final completer = Completer<Tokens>();
      when(() => api.guestLogin(any())).thenAnswer((_) => completer.future);

      await tester.pumpWidget(_wrap(api));

      await tester.tap(_guestButtonKey);
      // Повторный тап до завершения запроса — не должен вызвать guestLogin
      // второй раз. Специально без промежуточного `pump()`: гонка, при
      // которой виджет ещё не перестроился с новым (заблокированным)
      // `onPressed`, — самый жёсткий случай для guard'а.
      await tester.tap(_guestButtonKey);
      await tester.pump();

      // Пока запрос летит — обе кнопки заблокированы.
      final phoneWidget = tester.widget<SqButton>(_phoneButtonKey);
      final guestWidget = tester.widget<SqButton>(_guestButtonKey);
      expect(phoneWidget.onPressed, isNull);
      expect(guestWidget.onPressed, isNull);
      expect(guestWidget.loading, isTrue);

      completer.complete(_guestTokens());
      await tester.pumpAndSettle();

      verify(() => api.guestLogin(any())).called(1);

      // После завершения запроса кнопки снова активны.
      final phoneAfter = tester.widget<SqButton>(_phoneButtonKey);
      expect(phoneAfter.onPressed, isNotNull);
    },
  );

  testWidgets(
    'ApiException из continueAsGuest показывает SnackBar с локализованным текстом',
    (tester) async {
      final api = MockSqApi();
      when(() => api.guestLogin(any()))
          .thenThrow(const ApiException(ApiErrorCode.network, 'no network', 0));

      await tester.pumpWidget(_wrap(api));

      final l10n = AppLocalizations.of(
        tester.element(find.byType(WelcomeScreen)),
      )!;

      await tester.tap(_guestButtonKey);
      await tester.pumpAndSettle();

      expect(find.widgetWithText(SnackBar, l10n.errorNetwork), findsOneWidget);
    },
  );

  testWidgets(
    'ссылка на пользовательское соглашение вызывает UrlLauncherPort с termsUrl',
    (tester) async {
      final launcher = _FakeUrlLauncherPort();
      await tester.pumpWidget(_wrap(MockSqApi(), urlLauncher: launcher));

      final l10n = AppLocalizations.of(
        tester.element(find.byType(WelcomeScreen)),
      )!;
      await tester.tap(find.text(l10n.welcomeTermsLink));
      await tester.pump();

      expect(launcher.launched, [termsUrl]);
    },
  );

  testWidgets(
    'ссылка на политику конфиденциальности вызывает UrlLauncherPort с privacyUrl',
    (tester) async {
      final launcher = _FakeUrlLauncherPort();
      await tester.pumpWidget(_wrap(MockSqApi(), urlLauncher: launcher));

      final l10n = AppLocalizations.of(
        tester.element(find.byType(WelcomeScreen)),
      )!;
      await tester.tap(find.text(l10n.welcomePrivacyLink));
      await tester.pump();

      expect(launcher.launched, [privacyUrl]);
    },
  );
}
