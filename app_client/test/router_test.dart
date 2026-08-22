// Тесты редирект-гарда `sqRouter`: таблица состояние×флаги → путь (Step 1
// брифа задачи 7, 6 случаев), плюс переключение вкладок `StatefulShellRoute`
// (включая системный "назад" внутри неё — ревью раунда 1) и два «золотых
// пути» — вход гостем и вход по телефону/SMS-коду с экрана `/welcome` —
// доказывающие, что редирект реально срабатывает ПОСЛЕ смены состояния
// `AuthController` (через `refreshListenable`), а не только на старте, и что
// имитационный (`Navigator.push`) поток `PhoneScreen`/`CodeScreen` поверх
// декларативной страницы `/welcome` не ломает последующий редирект
// `go_router`. Плюс тест на стрелку возврата у заглушек `/topic`/`/session`
// (тоже ревью раунда 1).
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:app_client/core/locale_controller.dart';
import 'package:app_client/core/providers.dart';
import 'package:app_client/core/route_paths.dart';
import 'package:app_client/core/token_store.dart';
import 'package:app_client/features/auth/state/auth_controller.dart';
import 'package:app_client/features/catalog/ui/catalog_screen.dart';
import 'package:app_client/features/consultations/ui/consultations_screen.dart';
import 'package:app_client/features/home/ui/home_screen.dart';
import 'package:app_client/features/onboarding/state/onboarding_flags.dart';
import 'package:app_client/features/onboarding/ui/slides_screen.dart';
import 'package:app_client/features/profile/ui/profile_screen.dart';
import 'package:app_client/features/funnel/ui/topic_screen.dart';
import 'package:app_client/l10n/app_localizations.dart';
import 'package:app_client/router.dart';

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

/// Фиксирует `AuthController` на заданном [_state] для теста редиректа —
/// не восстанавливает сессию и не трогает сеть, просто отдаёт готовое
/// состояние (см. disambiguation №5 задачи 7: `restore()` — обязанность
/// `SplashScreen`, вызывается ровно один раз, редирект-гард её не дёргает).
///
/// `restore()` переопределён в но-оп: при `authState: AuthUnknown` реально
/// монтируется настоящий `SplashScreen` (это и есть проверяемое поведение),
/// а его `initState` зовёт `restore()` на инжектированном контроллере — без
/// переопределения сработал бы БАЗОВЫЙ `restore()` и тут же перезаписал бы
/// зафиксированное тестом состояние настоящим результатом чтения
/// `SecureStore` (пустого, значит `AuthAnonymous`), и тест «AuthUnknown ->
/// /splash» ловил бы уже `/welcome` — гонку между зафиксированным тестом
/// состоянием и настоящей логикой контроллера.
class _FixedAuthController extends AuthController {
  _FixedAuthController(this._state);
  final AuthState _state;

  @override
  FutureOr<AuthState> build() => _state;

  @override
  Future<void> restore() async {}
}

AuthUser _guestUser() =>
    const AuthUser(id: 'guest-1', phone: null, isGuest: true);

AuthUser _registeredUser() =>
    const AuthUser(id: 'u1', phone: '+77011234567', isGuest: false);

Tokens _guestTokens() =>
    Tokens(accessToken: 'a', refreshToken: 'r', user: _guestUser());

Tokens _registeredTokens() =>
    Tokens(accessToken: 'a2', refreshToken: 'r2', user: _registeredUser());

List<Topic> _fakeTopics() => List.generate(
  3,
  (i) => Topic(id: 't$i', slug: 'topic-$i', name: 'Тема $i'),
);

/// Готовит контейнер с фиксированным состоянием сессии и заданными флагами
/// онбординга — ровно то, что описывает таблица редиректа брифа
/// («устанавливается через `ProviderContainer.overrides`»).
Future<ProviderContainer> _fixedContainer({
  required AuthState authState,
  bool seenSlides = true,
  bool askedPermissions = true,
}) async {
  SharedPreferences.setMockInitialValues({
    'sq.onboarding.slides': seenSlides,
    'sq.onboarding.permissions': askedPermissions,
  });
  final prefs = await SharedPreferences.getInstance();
  final api = MockSqApi();
  when(
    () => api.topics(locale: any(named: 'locale')),
  ).thenAnswer((_) async => _fakeTopics());
  when(
    () => api.consultations(status: any(named: 'status')),
  ).thenAnswer((_) async => <ClientConsultation>[]);

  final container = ProviderContainer(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      sqApiProvider.overrideWithValue(api),
      secureStoreProvider.overrideWithValue(_FakeSecureStore()),
      authControllerProvider.overrideWith(
        () => _FixedAuthController(authState),
      ),
    ],
  );
  return container;
}

/// Монтирует настоящее приложение (`MaterialApp.router` поверх
/// `sqRouter`) на заданном [container] и возвращает путь, на котором
/// редирект-гард в итоге остановился.
Future<String> _resolvedPath(
  WidgetTester tester,
  ProviderContainer container,
) async {
  final router = container.read(routerProvider);
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(
        routerConfig: router,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
      ),
    ),
  );
  // Не `pumpAndSettle()`: пока состояние — `AuthUnknown`, на экране реально
  // остаётся `SplashScreen` со `SqLoader` (бесконечно анимированный
  // `CircularProgressIndicator`), на котором `pumpAndSettle()` никогда не
  // завершился бы. Фиксированное число кадров с лихвой покрывает цепочку
  // «текущий кадр → postFrameCallback → завершение Future → setState →
  // пересборка → редирект», которая нигде в этих тестах не требует более
  // одного реального асинхронного шага.
  for (var i = 0; i < 10; i++) {
    await tester.pump(const Duration(milliseconds: 16));
  }
  return router.routeInformationProvider.value.uri.path;
}

void main() {
  setUpAll(() {
    registerFallbackValue(ConsultationStatus.active);
    registerFallbackValue('device-id');
    registerFallbackValue('+77011234567');
  });

  group('sqRouter — таблица редиректа состояние×флаги → путь', () {
    testWidgets('AuthUnknown -> /splash', (tester) async {
      final container = await _fixedContainer(authState: const AuthUnknown());
      addTearDown(container.dispose);

      expect(await _resolvedPath(tester, container), RoutePaths.splash);
    });

    testWidgets('AuthAnonymous -> /welcome', (tester) async {
      final container = await _fixedContainer(
        authState: const AuthAnonymous(),
      );
      addTearDown(container.dispose);

      expect(await _resolvedPath(tester, container), RoutePaths.welcome);
    });

    testWidgets('авторизован (Guest), !seenSlides -> /onboarding', (
      tester,
    ) async {
      final container = await _fixedContainer(
        authState: AuthGuest(_guestUser()),
        seenSlides: false,
      );
      addTearDown(container.dispose);

      expect(await _resolvedPath(tester, container), RoutePaths.onboarding);
    });

    testWidgets(
      'авторизован (Guest), seenSlides и !askedPermissions -> /permissions',
      (tester) async {
        final container = await _fixedContainer(
          authState: AuthGuest(_guestUser()),
          askedPermissions: false,
        );
        addTearDown(container.dispose);

        expect(
          await _resolvedPath(tester, container),
          RoutePaths.permissions,
        );
      },
    );

    testWidgets(
      'авторизован (Guest), оба флага пройдены -> вход в ShellRoute на /home',
      (tester) async {
        final container = await _fixedContainer(
          authState: AuthGuest(_guestUser()),
        );
        addTearDown(container.dispose);

        expect(await _resolvedPath(tester, container), RoutePaths.home);
        expect(find.byType(HomeScreen), findsOneWidget);
      },
    );

    testWidgets(
      'авторизован (Registered), оба флага пройдены -> вход в ShellRoute на /home',
      (tester) async {
        final container = await _fixedContainer(
          authState: AuthRegistered(_registeredUser()),
        );
        addTearDown(container.dispose);

        expect(await _resolvedPath(tester, container), RoutePaths.home);
      },
    );
  });

  group('StatefulShellRoute — переключение вкладок нижней навигации', () {
    testWidgets('тапы по вкладкам показывают соответствующий экран', (
      tester,
    ) async {
      final container = await _fixedContainer(
        authState: AuthGuest(_guestUser()),
      );
      addTearDown(container.dispose);
      await _resolvedPath(tester, container);

      expect(find.byType(HomeScreen), findsOneWidget);

      await tester.tap(find.byKey(const Key('sq-nav-catalog')));
      await tester.pumpAndSettle();
      expect(find.byType(CatalogScreen), findsOneWidget);

      await tester.tap(find.byKey(const Key('sq-nav-consultations')));
      await tester.pumpAndSettle();
      expect(find.byType(ConsultationsScreen), findsOneWidget);

      await tester.tap(find.byKey(const Key('sq-nav-profile')));
      await tester.pumpAndSettle();
      expect(find.byType(ProfileScreen), findsOneWidget);

      await tester.tap(find.byKey(const Key('sq-nav-home')));
      await tester.pumpAndSettle();
      expect(find.byType(HomeScreen), findsOneWidget);
    });
  });

  group('золотой путь: смена состояния сессии реально запускает редирект', () {
    testWidgets(
      'гостевой вход с /welcome доводит (через refreshListenable) до /onboarding',
      (tester) async {
        // Реальный AuthController (не фиксированный): восстановление сессии
        // при старте (`SplashScreen.initState`) с пустым хранилищем даёт
        // AuthAnonymous -> редирект на /welcome без единого ручного шага.
        SharedPreferences.setMockInitialValues({});
        final prefs = await SharedPreferences.getInstance();
        final api = MockSqApi();
        when(
          () => api.guestLogin(any()),
        ).thenAnswer((_) async => _guestTokens());

        final container = ProviderContainer(
          overrides: [
            sharedPreferencesProvider.overrideWithValue(prefs),
            sqApiProvider.overrideWithValue(api),
            secureStoreProvider.overrideWithValue(_FakeSecureStore()),
          ],
        );
        addTearDown(container.dispose);

        final router = container.read(routerProvider);
        await tester.pumpWidget(
          UncontrolledProviderScope(
            container: container,
            child: MaterialApp.router(
              routerConfig: router,
              localizationsDelegates: AppLocalizations.localizationsDelegates,
              supportedLocales: AppLocalizations.supportedLocales,
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(router.routeInformationProvider.value.uri.path,
            RoutePaths.welcome);

        await tester.tap(find.byKey(const Key('sq-welcome-guest-button')));
        await tester.pumpAndSettle();

        expect(
          router.routeInformationProvider.value.uri.path,
          RoutePaths.onboarding,
        );
        expect(find.byType(SlidesScreen), findsOneWidget);
      },
    );

    testWidgets(
      'вход по телефону/SMS-коду (Navigator.push поверх /welcome) тоже '
      'доводит до /onboarding — смешение push-потока и редиректа не роняет '
      'приложение',
      (tester) async {
        SharedPreferences.setMockInitialValues({});
        final prefs = await SharedPreferences.getInstance();
        final api = MockSqApi();
        when(() => api.requestCode(any())).thenAnswer((_) async {});
        when(
          () => api.verifyCode(any(), any()),
        ).thenAnswer((_) async => _registeredTokens());

        final container = ProviderContainer(
          overrides: [
            sharedPreferencesProvider.overrideWithValue(prefs),
            sqApiProvider.overrideWithValue(api),
            secureStoreProvider.overrideWithValue(_FakeSecureStore()),
          ],
        );
        addTearDown(container.dispose);

        final router = container.read(routerProvider);
        await tester.pumpWidget(
          UncontrolledProviderScope(
            container: container,
            child: MaterialApp.router(
              routerConfig: router,
              localizationsDelegates: AppLocalizations.localizationsDelegates,
              supportedLocales: AppLocalizations.supportedLocales,
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(router.routeInformationProvider.value.uri.path,
            RoutePaths.welcome);

        await tester.tap(find.byKey(const Key('sq-welcome-phone-button')));
        await tester.pumpAndSettle();

        // Ввод номера посимвольно — настоящий путь пользователя, а не один
        // вызов enterText (см. урок задачи 5 про маску телефона).
        final phoneField = find.byType(TextField).first;
        var typed = '';
        for (final ch in '701234567'.split('')) {
          typed += ch;
          await tester.enterText(phoneField, typed);
          await tester.pump();
        }
        await tester.tap(find.byType(InkWell).first);
        await tester.pumpAndSettle();

        final codeFields = find.byType(TextField);
        for (var i = 0; i < 4; i++) {
          await tester.enterText(codeFields.at(i), '${i + 1}');
        }
        await tester.pumpAndSettle();

        expect(tester.takeException(), isNull);
        expect(
          router.routeInformationProvider.value.uri.path,
          RoutePaths.onboarding,
        );
        expect(find.byType(SlidesScreen), findsOneWidget);
      },
    );
  });

  group('золотой путь: цепочка онбординга реально ведёт на /home', () {
    testWidgets(
      '/onboarding «Пропустить» -> /permissions «Позже» -> /home',
      (tester) async {
        final container = await _fixedContainer(
          authState: AuthGuest(_guestUser()),
          seenSlides: false,
          askedPermissions: false,
        );
        addTearDown(container.dispose);

        final router = container.read(routerProvider);
        await tester.pumpWidget(
          UncontrolledProviderScope(
            container: container,
            child: MaterialApp.router(
              routerConfig: router,
              localizationsDelegates: AppLocalizations.localizationsDelegates,
              supportedLocales: AppLocalizations.supportedLocales,
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(
          router.routeInformationProvider.value.uri.path,
          RoutePaths.onboarding,
        );

        final l10nSlides = AppLocalizations.of(
          tester.element(find.byType(SlidesScreen)),
        )!;
        await tester.tap(find.text(l10nSlides.slidesSkip));
        await tester.pumpAndSettle();

        expect(
          router.routeInformationProvider.value.uri.path,
          RoutePaths.permissions,
          reason:
              'seenSlides стал true, но askedPermissions всё ещё false — '
              'редирект обязан остановить на /permissions, а не пустить на /home',
        );
        expect(OnboardingFlags(container.read(sharedPreferencesProvider))
            .seenSlides, isTrue);

        await tester.tap(find.byKey(const Key('sq-permissions-later-button')));
        await tester.pumpAndSettle();

        expect(router.routeInformationProvider.value.uri.path, RoutePaths.home);
        expect(find.byType(HomeScreen), findsOneWidget);
      },
    );
  });

  group('заглушки /topic и /session — возврат назад (ревью раунда 1)', () {
    testWidgets(
      'AppBar заглушки темы даёт стрелку назад, тап возвращает на /home',
      (tester) async {
        final container = await _fixedContainer(
          authState: AuthGuest(_guestUser()),
        );
        addTearDown(container.dispose);
        await _resolvedPath(tester, container);
        expect(find.byType(HomeScreen), findsOneWidget);

        await tester.tap(find.byKey(const Key('sq-topic-topic-0')));
        await tester.pumpAndSettle();

        expect(find.byType(TopicScreen), findsOneWidget);
        expect(find.byType(HomeScreen), findsNothing);

        // `TopicScreen`/`SessionScreen` открываются через `context.push` с
        // главной — до ревью раунда 1 у них не было `AppBar`, и вернуться
        // можно было только системным жестом. `BackButton` появляется у
        // `AppBar` автоматически, когда `Navigator.canPop(context)` истинно
        // (см. `AppBar._getEffectiveLeading` в Flutter SDK) — то есть сам
        // факт его присутствия доказывает, что `AppBar()` добавлен.
        final backButton = find.byType(BackButton);
        expect(
          backButton,
          findsOneWidget,
          reason:
              'у TopicScreen должен быть AppBar со стрелкой назад — экран '
              'открывается через context.push, системный жест единственным '
              'способом возврата быть не должен',
        );
        await tester.tap(backButton);
        await tester.pumpAndSettle();

        expect(find.byType(HomeScreen), findsOneWidget);
        expect(find.byType(TopicScreen), findsNothing);
      },
    );
  });

  group('нижняя навигация — системный "назад" внутри StatefulShellRoute', () {
    testWidgets(
      'с вкладки "Каталог" системный back возвращает на "Главная", а не '
      'выходит из приложения',
      (tester) async {
        final container = await _fixedContainer(
          authState: AuthGuest(_guestUser()),
        );
        addTearDown(container.dispose);
        await _resolvedPath(tester, container);
        expect(find.byType(HomeScreen), findsOneWidget);

        await tester.tap(find.byKey(const Key('sq-nav-catalog')));
        await tester.pumpAndSettle();
        expect(find.byType(CatalogScreen), findsOneWidget);

        // `tester.binding.handlePopRoute()` — штатный способ теста
        // симулировать системную кнопку «назад» (Android), не завязанный на
        // конкретный Navigator в дереве: он дублирует то, что платформенный
        // канал `SystemChannels.navigation` шлёт приложению по факту нажатия
        // аппаратной кнопки. При `ShellRoute` (один общий Navigator на все
        // вкладки, версия ДО этого раунда правок) это проваливалось сквозь
        // приложение — `PopScope` внутри `AppShell` перехватывает такой
        // вызов и переключает на вкладку «Главная», а не отдаёт его
        // `SystemNavigator.pop()`.
        final popped = await tester.binding.handlePopRoute();
        await tester.pumpAndSettle();

        expect(
          popped,
          isTrue,
          reason:
              '`PopScope` на вкладке обязан сам обработать системный back, '
              'не отдавая его дальше на выход из приложения',
        );
        expect(
          find.byType(HomeScreen),
          findsOneWidget,
          reason:
              'назад с пустой вкладки "Каталог" обязан вернуть на "Главная", '
              'а не провалиться сквозь приложение',
        );
        expect(find.byType(CatalogScreen), findsNothing);
      },
    );
  });
}
