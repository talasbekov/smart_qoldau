// Виджет-тесты профиля (Step 1 брифа задачи 19): гостевой блок, выход с
// разными предупреждениями, смена языка и удаление аккаунта обращением.
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
import 'package:app_client/features/profile/ui/profile_screen.dart';
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

Tokens _tokens({required bool isGuest}) => Tokens(
  accessToken: 'access',
  refreshToken: 'refresh',
  user: AuthUser(
    id: 'u1',
    phone: isGuest ? null : '+77011234567',
    isGuest: isGuest,
  ),
);

Future<Widget> _wrap(SqApi api, {required bool isGuest}) async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();
  final secure = _FakeSecureStore();
  await TokenStore(secure).write(_tokens(isGuest: isGuest));

  final router = GoRouter(
    initialLocation: RoutePaths.profile,
    routes: [
      GoRoute(
        path: RoutePaths.profile,
        builder: (context, state) => const ProfileScreen(),
      ),
      GoRoute(
        path: RoutePaths.welcome,
        builder: (context, state) =>
            const Scaffold(body: Text('sq-stub-welcome')),
      ),
      GoRoute(
        path: RoutePaths.convertGuest,
        builder: (context, state) =>
            const Scaffold(body: Text('sq-stub-convert')),
      ),
      GoRoute(
        path: RoutePaths.support,
        builder: (context, state) =>
            const Scaffold(body: Text('sq-stub-support')),
      ),
      GoRoute(
        path: RoutePaths.cards,
        builder: (context, state) => const Scaffold(body: Text('sq-stub-cards')),
      ),
      GoRoute(
        path: RoutePaths.premium,
        builder: (context, state) =>
            const Scaffold(body: Text('sq-stub-premium')),
      ),
      GoRoute(
        path: RoutePaths.favorites,
        builder: (context, state) =>
            const Scaffold(body: Text('sq-stub-favorites')),
      ),
      GoRoute(
        path: RoutePaths.notifications,
        builder: (context, state) =>
            const Scaffold(body: Text('sq-stub-notifications')),
      ),
    ],
  );
  addTearDown(router.dispose);

  return ProviderScope(
    overrides: [
      sqApiProvider.overrideWithValue(api),
      secureStoreProvider.overrideWithValue(secure),
      sharedPreferencesProvider.overrideWithValue(prefs),
      systemLocaleProvider.overrideWithValue(const Locale('ru')),
    ],
    child: MaterialApp.router(
      routerConfig: router,
      locale: const Locale('ru'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
    ),
  );
}

/// Профиль читает состояние сессии из `AuthController` — восстанавливаем
/// её так же, как это делает заставка приложения.
Future<void> _restoreSession(WidgetTester tester) async {
  final element = tester.element(find.byType(ProfileScreen));
  final container = ProviderScope.containerOf(element);
  await container.read(authControllerProvider.notifier).restore();
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(() {
    registerFallbackValue(ConsultationStatus.completed);
  });

  late MockSqApi api;

  setUp(() {
    api = MockSqApi();
    when(
      () => api.consultations(
        status: any(named: 'status'),
        take: any(named: 'take'),
        skip: any(named: 'skip'),
      ),
    ).thenAnswer((_) async => []);
    when(() => api.updateLocale(any())).thenAnswer((_) async {});
    when(
      () => api.createTicket(
        category: any(named: 'category'),
        subject: any(named: 'subject'),
        body: any(named: 'body'),
        contactEmail: any(named: 'contactEmail'),
        contactPhone: any(named: 'contactPhone'),
        relatedConsultationId: any(named: 'relatedConsultationId'),
        relatedPayoutId: any(named: 'relatedPayoutId'),
      ),
    ).thenAnswer((_) async {});
    when(
      () => api.tickets(take: any(named: 'take'), skip: any(named: 'skip')),
    ).thenAnswer((_) async => []);
    when(() => api.premiumStatus()).thenAnswer((_) async => PremiumStatus.none);
  });

  testWidgets('профиль показывает статус Premium и ведёт на экран', (
    tester,
  ) async {
    when(() => api.premiumStatus()).thenAnswer(
      (_) async => PremiumStatus(
        active: true,
        cancelled: false,
        inGrace: false,
        plan: PremiumPlan.month,
        currentPeriodEnd: DateTime.utc(2026, 9, 26),
      ),
    );

    await tester.pumpWidget(await _wrap(api, isGuest: false));
    await tester.pumpAndSettle();
    await _restoreSession(tester);

    // Статус виден прямо в списке: ради ответа «подписан я или нет»
    // открывать отдельный экран человек не должен.
    expect(find.textContaining('26.09.2026'), findsOneWidget);

    await tester.tap(find.byKey(const Key('sq-profile-item-premium')));
    await tester.pumpAndSettle();
    expect(find.text('sq-stub-premium'), findsOneWidget);
  });

  testWidgets('без подписки в профиле написан базовый тариф', (tester) async {
    await tester.pumpWidget(await _wrap(api, isGuest: false));
    await tester.pumpAndSettle();
    await _restoreSession(tester);

    expect(find.text('Базовый тариф'), findsOneWidget);
  });

  testWidgets('гость видит блок создания аккаунта', (tester) async {
    await tester.pumpWidget(await _wrap(api, isGuest: true));
    await tester.pumpAndSettle();
    await _restoreSession(tester);

    expect(find.text('Создайте аккаунт'), findsOneWidget);

    await tester.tap(find.text('Создать аккаунт'));
    await tester.pumpAndSettle();

    expect(find.text('sq-stub-convert'), findsOneWidget);
  });

  testWidgets('зарегистрированный видит телефон и не видит блок гостя', (
    tester,
  ) async {
    await tester.pumpWidget(await _wrap(api, isGuest: false));
    await tester.pumpAndSettle();
    await _restoreSession(tester);

    expect(find.text('+77011234567'), findsOneWidget);
    expect(find.text('Создайте аккаунт'), findsNothing);
  });

  testWidgets('выход гостя предупреждает о безвозвратной потере сессии', (
    tester,
  ) async {
    await tester.pumpWidget(await _wrap(api, isGuest: true));
    await tester.pumpAndSettle();
    await _restoreSession(tester);

    await tester.scrollUntilVisible(find.text('Выйти'), 300, maxScrolls: 30);
    await tester.ensureVisible(find.text('Выйти'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Выйти'));
    await tester.pumpAndSettle();

    expect(find.textContaining('безвозвратно'), findsOneWidget);
  });

  testWidgets('выход зарегистрированного — обычное подтверждение', (
    tester,
  ) async {
    await tester.pumpWidget(await _wrap(api, isGuest: false));
    await tester.pumpAndSettle();
    await _restoreSession(tester);

    await tester.scrollUntilVisible(find.text('Выйти'), 300, maxScrolls: 30);
    await tester.ensureVisible(find.text('Выйти'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Выйти'));
    await tester.pumpAndSettle();

    expect(
      find.text('Вы сможете войти снова по номеру телефона'),
      findsOneWidget,
    );
    expect(find.textContaining('безвозвратно'), findsNothing);

    await tester.tap(find.text('Выйти').last);
    await tester.pumpAndSettle();

    expect(find.text('sq-stub-welcome'), findsOneWidget);
  });

  testWidgets('смена языка сообщает бэкенду локаль kz', (tester) async {
    await tester.pumpWidget(await _wrap(api, isGuest: false));
    await tester.pumpAndSettle();
    await _restoreSession(tester);

    await tester.scrollUntilVisible(find.text('Язык'), 300, maxScrolls: 30);
    await tester.ensureVisible(find.text('Язык'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Язык'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Қазақша'));
    await tester.pumpAndSettle();

    verify(() => api.updateLocale('kz')).called(1);
  });

  testWidgets('удаление аккаунта: подтверждение -> DELETE /me -> экран входа', (
    tester,
  ) async {
    when(() => api.deleteAccount()).thenAnswer((_) async {});
    await tester.pumpWidget(await _wrap(api, isGuest: false));
    await tester.pumpAndSettle();
    await _restoreSession(tester);

    await tester.scrollUntilVisible(
      find.text('Удалить аккаунт'),
      300,
      maxScrolls: 30,
    );
    // `scrollUntilVisible` останавливается, как только элемент появился в
    // дереве — он может стоять ровно на границе экрана; доводим до конца.
    await tester.ensureVisible(find.text('Удалить аккаунт'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Удалить аккаунт'));
    await tester.pumpAndSettle();

    // Диалог обязан сказать, что именно исчезнет, а что останется.
    expect(find.textContaining('удалены безвозвратно'), findsOneWidget);
    expect(find.textContaining('останутся в бухгалтерии'), findsOneWidget);

    await tester.tap(find.text('Удалить аккаунт').last);
    await tester.pumpAndSettle();

    verify(() => api.deleteAccount()).called(1);
    expect(find.text('sq-stub-welcome'), findsOneWidget);
  });

  testWidgets('отказ CONSULTATION_IN_PROGRESS: аккаунт цел, показана причина', (
    tester,
  ) async {
    when(() => api.deleteAccount()).thenThrow(
      const ApiException(
        ApiErrorCode.consultationInProgress,
        'Сначала завершите или отмените консультацию',
        409,
      ),
    );
    await tester.pumpWidget(await _wrap(api, isGuest: false));
    await tester.pumpAndSettle();
    await _restoreSession(tester);

    await tester.scrollUntilVisible(
      find.text('Удалить аккаунт'),
      300,
      maxScrolls: 30,
    );
    await tester.ensureVisible(find.text('Удалить аккаунт'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Удалить аккаунт'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Удалить аккаунт').last);
    await tester.pumpAndSettle();

    // Остались в профиле, причина объяснена словами приложения, а не
    // сообщением бэкенда.
    expect(find.text('sq-stub-welcome'), findsNothing);
    expect(
      find.textContaining('удалить аккаунт посреди неё нельзя'),
      findsOneWidget,
    );
  });

  testWidgets('пункты профиля ведут по своим маршрутам', (tester) async {
    await tester.pumpWidget(await _wrap(api, isGuest: false));
    await tester.pumpAndSettle();
    await _restoreSession(tester);

    await tester.tap(find.text('Способы оплаты'));
    await tester.pumpAndSettle();
    expect(find.text('sq-stub-cards'), findsOneWidget);
  });
}
