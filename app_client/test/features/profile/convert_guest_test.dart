// Тесты конверсии гостя в аккаунт (Step 2 брифа задачи 19, Р-22).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:app_client/core/locale_controller.dart';
import 'package:app_client/core/providers.dart';
import 'package:app_client/core/route_paths.dart';
import 'package:app_client/core/token_store.dart';
import 'package:app_client/features/auth/state/auth_controller.dart';
import 'package:app_client/features/profile/ui/convert_guest_screen.dart';
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

Tokens _guestTokens() => const Tokens(
  accessToken: 'access-guest',
  refreshToken: 'refresh-guest',
  user: AuthUser(id: 'u1', phone: null, isGuest: true),
);

Tokens _registeredTokens() => const Tokens(
  accessToken: 'access-registered',
  refreshToken: 'refresh-registered',
  user: AuthUser(id: 'u1', phone: '+77011234567', isGuest: false),
);

Future<(Widget, ProviderContainer)> _wrap(SqApi api) async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();
  final secure = _FakeSecureStore();
  await TokenStore(secure).write(_guestTokens());

  final router = GoRouter(
    initialLocation: RoutePaths.convertGuest,
    routes: [
      GoRoute(
        path: RoutePaths.convertGuest,
        builder: (context, state) => const ConvertGuestScreen(),
      ),
      GoRoute(
        path: RoutePaths.profile,
        builder: (context, state) =>
            const Scaffold(body: Text('sq-stub-profile')),
      ),
    ],
  );
  addTearDown(router.dispose);

  final container = ProviderContainer(
    overrides: [
      sqApiProvider.overrideWithValue(api),
      secureStoreProvider.overrideWithValue(secure),
      sharedPreferencesProvider.overrideWithValue(prefs),
      systemLocaleProvider.overrideWithValue(const Locale('ru')),
    ],
  );
  addTearDown(container.dispose);

  return (
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(
        routerConfig: router,
        locale: const Locale('ru'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
      ),
    ),
    container,
  );
}

Future<void> _enterPhoneAndCode(WidgetTester tester) async {
  await tester.enterText(
    find.byKey(const Key('sq-convert-phone')),
    '7011234567',
  );
  await tester.pump();
  await tester.tap(find.byKey(const Key('sq-convert-request-code')));
  await tester.pumpAndSettle();

  await tester.enterText(find.byKey(const Key('sq-convert-code')), '123456');
  await tester.pump();
  await tester.tap(find.byKey(const Key('sq-convert-submit')));
  await tester.pumpAndSettle();
}

void main() {
  late MockSqApi api;

  setUp(() {
    api = MockSqApi();
    when(() => api.requestCode(any())).thenAnswer((_) async {});
  });

  testWidgets('успешная конверсия делает гостя зарегистрированным', (
    tester,
  ) async {
    when(
      () => api.convertGuest(any(), any()),
    ).thenAnswer((_) async => _registeredTokens());

    final (widget, container) = await _wrap(api);
    await tester.pumpWidget(widget);
    await container.read(authControllerProvider.notifier).restore();
    await tester.pumpAndSettle();

    await _enterPhoneAndCode(tester);

    final state = container.read(authControllerProvider).value;
    expect(state, isA<AuthRegistered>());
    expect((state! as AuthRegistered).user.id, 'u1');
    expect(find.text('sq-stub-profile'), findsOneWidget);
  });

  testWidgets('PHONE_ALREADY_REGISTERED объясняет и НЕ разлогинивает гостя', (
    tester,
  ) async {
    when(() => api.convertGuest(any(), any())).thenAnswer(
      (_) async => throw const ApiException(
        ApiErrorCode.phoneAlreadyRegistered,
        'already registered',
        409,
      ),
    );

    final (widget, container) = await _wrap(api);
    await tester.pumpWidget(widget);
    await container.read(authControllerProvider.notifier).restore();
    await tester.pumpAndSettle();

    await _enterPhoneAndCode(tester);

    expect(
      find.textContaining('не перенесутся'),
      findsOneWidget,
      reason: 'клиент должен понимать, что данные гостя в чужой аккаунт не '
          'переедут',
    );
    expect(container.read(authControllerProvider).value, isA<AuthGuest>());
  });

  testWidgets('неверный код показывает ошибку и оставляет форму рабочей', (
    tester,
  ) async {
    when(() => api.convertGuest(any(), any())).thenAnswer(
      (_) async => throw const ApiException(
        ApiErrorCode.smsCodeInvalid,
        'invalid',
        400,
      ),
    );

    final (widget, container) = await _wrap(api);
    await tester.pumpWidget(widget);
    await container.read(authControllerProvider.notifier).restore();
    await tester.pumpAndSettle();

    await _enterPhoneAndCode(tester);

    expect(find.text('Неверный код'), findsOneWidget);
    expect(container.read(authControllerProvider).value, isA<AuthGuest>());
  });
}
