// Виджет-тесты профиля специалиста (Step 3 брифа задачи 16): распределение
// рейтинга, догрузка отзывов, запись к специалисту и её отказная ветка,
// человекочитаемые темы вместо slug'ов, избранное.
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
import 'package:app_client/features/catalog/ui/expert_screen.dart';
import 'package:app_client/l10n/app_localizations.dart';

class MockSqApi extends Mock implements SqApi {}

ExpertPublic _expert() => const ExpertPublic(
  id: 'e1',
  displayName: 'Динара С.',
  city: 'Алматы',
  experience: ExperienceLevel.threeToFive,
  priceTiyn: 399000,
  languages: ['ru', 'kz'],
  formats: [SessionFormat.chat, SessionFormat.audio],
  topicSlugs: ['anxiety-stress', 'burnout'],
  workStatus: WorkStatus.accepting,
  ratingAvg: 4.9,
  ratingCount: 312,
);

ExpertReviews _reviews({required List<ReviewItem> items}) => ExpertReviews(
  items: items,
  distribution: const RatingDistribution(
    rating1: 2,
    rating2: 3,
    rating3: 7,
    rating4: 40,
    rating5: 260,
  ),
  ratingAvg: 4.9,
  ratingCount: 312,
);

ReviewItem _review(String text) => ReviewItem(
  rating: 5,
  publicText: text,
  createdAt: DateTime(2026, 8, 20),
);

Future<Widget> _wrap(SqApi api) async {
  SharedPreferences.setMockInitialValues({});
  final prefs = await SharedPreferences.getInstance();

  final router = GoRouter(
    initialLocation: RoutePaths.expert('e1'),
    routes: [
      GoRoute(
        path: RoutePaths.expertPattern,
        builder: (context, state) =>
            ExpertScreen(expertId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: RoutePaths.searchPattern,
        builder: (context, state) => Scaffold(
          body: Text('sq-stub-search:${state.pathParameters['requestId']}'),
        ),
      ),
    ],
  );
  addTearDown(router.dispose);

  return ProviderScope(
    overrides: [
      sqApiProvider.overrideWithValue(api),
      sharedPreferencesProvider.overrideWithValue(prefs),
    ],
    child: MaterialApp.router(
      routerConfig: router,
      locale: const Locale('ru'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
    ),
  );
}

/// Прокручивает до элемента: `ListView` строит детей лениво, и нижние
/// кнопки экрана до скролла в дереве вообще отсутствуют — реальный
/// пользователь до них тоже доскроллит.
Future<void> _scrollTo(WidgetTester tester, Finder finder) async {
  await tester.scrollUntilVisible(finder, 300, maxScrolls: 30);
  await tester.pumpAndSettle();
}

/// Полный путь записи: формат -> тема. Тему спрашиваем, потому что у
/// специалиста их несколько, а заявка без темы бэкендом не принимается
/// (фильтр каталога темы в этом тесте не задаёт).
Future<void> _book(
  WidgetTester tester,
  String formatLabel, {
  String topicSlug = 'anxiety-stress',
}) async {
  // Мгновенная консультация — вторая кнопка: «Записаться» с E6b ведёт на
  // выбор времени, а не создаёт заявку немедленно.
  await _scrollTo(tester, find.text('Связаться сейчас'));
  await tester.tap(find.text('Связаться сейчас'));
  await tester.pumpAndSettle();
  await tester.tap(find.text(formatLabel));
  await tester.pumpAndSettle();
  // По ключу, а не по тексту: то же название темы уже нарисовано чипом в
  // профиле, и поиск по тексту нашёл бы два виджета.
  await tester.tap(find.byKey(Key('sq-topic-option-$topicSlug')));
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(() => registerFallbackValue(SessionFormat.chat));

  late MockSqApi api;

  setUp(() {
    api = MockSqApi();
    when(() => api.expertById('e1')).thenAnswer((_) async => _expert());
    when(
      () => api.expertReviews('e1', take: any(named: 'take'), skip: any(named: 'skip')),
    ).thenAnswer((_) async => _reviews(items: [_review('очень помогла')]));
    when(
      () => api.favorites(take: any(named: 'take'), skip: any(named: 'skip')),
    ).thenAnswer((_) async => []);
    when(() => api.addFavorite(any())).thenAnswer((_) async {});
    when(() => api.removeFavorite(any())).thenAnswer((_) async {});
    when(() => api.topics(locale: any(named: 'locale'))).thenAnswer(
      (_) async => const [
        Topic(id: 't1', slug: 'anxiety-stress', name: 'Тревога и стресс'),
        Topic(id: 't2', slug: 'burnout', name: 'Выгорание'),
      ],
    );
    when(
      () => api.createRequest(
        topicSlug: any(named: 'topicSlug'),
        format: any(named: 'format'),
        isEmergency: any(named: 'isEmergency'),
        expertId: any(named: 'expertId'),
      ),
    ).thenAnswer(
      (_) async => const MatchRequest(
        id: 'r1',
        status: RequestStatus.searching,
        isEmergency: false,
        clientCode: 4821,
      ),
    );
  });

  testWidgets('показывает карточку, цену и распределение оценок', (
    tester,
  ) async {
    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    expect(find.text('Динара С.'), findsOneWidget);
    expect(find.text('3 990 ₸'), findsOneWidget);
    expect(find.text('312 отзывов'), findsOneWidget);
    // Распределение: по строке на каждый уровень оценки с числом отзывов.
    expect(find.byKey(const Key('sq-expert-distribution-5')), findsOneWidget);
    expect(find.text('260'), findsOneWidget);
    expect(find.text('40'), findsOneWidget);
  });

  testWidgets('темы показаны названиями, а не slug-ами', (tester) async {
    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    expect(find.text('Тревога и стресс'), findsOneWidget);
    expect(find.text('Выгорание'), findsOneWidget);
    expect(find.text('anxiety-stress'), findsNothing);
  });

  testWidgets('неизвестный slug показывается как есть, а не исчезает', (
    tester,
  ) async {
    // Справочник тем и специализации эксперта могут разойтись (тема
    // выведена из справочника, но у эксперта осталась) — прятать её значит
    // молча терять информацию профиля.
    when(() => api.topics(locale: any(named: 'locale'))).thenAnswer(
      (_) async => const [
        Topic(id: 't1', slug: 'anxiety-stress', name: 'Тревога и стресс'),
      ],
    );

    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    expect(find.text('burnout'), findsOneWidget);
  });

  testWidgets('отзывы догружаются следующей страницей без дублей', (
    tester,
  ) async {
    when(() => api.expertReviews('e1', take: any(named: 'take'), skip: 0))
        .thenAnswer((_) async => _reviews(items: [_review('первый отзыв')]));
    when(() => api.expertReviews('e1', take: any(named: 'take'), skip: 1))
        .thenAnswer((_) async => _reviews(items: [_review('второй отзыв')]));

    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    await _scrollTo(tester, find.text('первый отзыв'));
    expect(find.text('первый отзыв'), findsOneWidget);

    await _scrollTo(tester, find.text('Показать ещё отзывы'));
    await tester.tap(find.text('Показать ещё отзывы'));
    await tester.pumpAndSettle();

    expect(find.text('первый отзыв'), findsOneWidget);
    expect(find.text('второй отзыв'), findsOneWidget);
  });

  testWidgets('«Связаться сейчас» создаёт адресную заявку и уводит на поиск', (
    tester,
  ) async {
    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    await _book(tester, 'Аудио');

    verify(
      () => api.createRequest(
        topicSlug: 'anxiety-stress',
        format: SessionFormat.audio,
        isEmergency: false,
        expertId: 'e1',
      ),
    ).called(1);
    expect(find.text('sq-stub-search:r1'), findsOneWidget);
  });

  testWidgets('EXPERT_UNAVAILABLE предлагает автоподбор без expertId', (
    tester,
  ) async {
    var calls = 0;
    when(
      () => api.createRequest(
        topicSlug: any(named: 'topicSlug'),
        format: any(named: 'format'),
        isEmergency: any(named: 'isEmergency'),
        expertId: any(named: 'expertId'),
      ),
    ).thenAnswer((invocation) async {
      calls++;
      if (invocation.namedArguments[#expertId] != null) {
        throw const ApiException(
          ApiErrorCode.expertUnavailable,
          'busy',
          409,
        );
      }
      return const MatchRequest(
        id: 'r-auto',
        status: RequestStatus.searching,
        isEmergency: false,
        clientCode: 4821,
      );
    });

    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    await _book(tester, 'Чат');

    expect(find.text('Специалист сейчас недоступен'), findsOneWidget);

    await tester.tap(find.text('Подобрать автоматически'));
    await tester.pumpAndSettle();

    verify(
      () => api.createRequest(
        topicSlug: 'anxiety-stress',
        format: SessionFormat.chat,
        isEmergency: false,
        expertId: null,
      ),
    ).called(1);
    expect(calls, 2);
    expect(find.text('sq-stub-search:r-auto'), findsOneWidget);
  });

  testWidgets('звезда добавляет специалиста в избранное', (tester) async {
    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('sq-expert-favorite')));
    await tester.pump();

    verify(() => api.addFavorite('e1')).called(1);
  });

  testWidgets('сбой загрузки профиля даёт SqErrorView с «Повторить»', (
    tester,
  ) async {
    var calls = 0;
    when(() => api.expertById('e1')).thenAnswer((_) async {
      calls++;
      if (calls == 1) {
        throw const ApiException(ApiErrorCode.network, 'нет сети', 0);
      }
      return _expert();
    });

    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    expect(find.text('Нет соединения с сервером'), findsOneWidget);

    await tester.tap(find.text('Повторить'));
    await tester.pumpAndSettle();

    expect(find.text('Динара С.'), findsOneWidget);
  });

  testWidgets('текст «о себе» показывается, когда он есть', (tester) async {
    when(() => api.expertById('e1')).thenAnswer(
      (_) async => _expert().copyWith(
        about: 'Работаю с тревогой и выгоранием, метод — КПТ.',
      ),
    );

    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    expect(
      find.text('Работаю с тревогой и выгоранием, метод — КПТ.'),
      findsOneWidget,
    );
  });

  testWidgets('при about == null блок не рисуется — без пустого заголовка', (
    tester,
  ) async {
    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('sq-expert-about')), findsNothing);
  });

  testWidgets('фотография из профиля попадает в аватар', (tester) async {
    when(() => api.expertById('e1')).thenAnswer(
      (_) async => _expert().copyWith(
        photoUrl: 'https://cdn.smartqoldau.kz/sq-avatars/a1b2.webp',
      ),
    );

    await tester.pumpWidget(await _wrap(api));
    await tester.pumpAndSettle();

    final avatar = tester.widget<SqAvatar>(find.byType(SqAvatar).first);
    expect(avatar.photoUrl, 'https://cdn.smartqoldau.kz/sq-avatars/a1b2.webp');
  });
}
