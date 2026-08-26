// Виджет-тесты экрана статьи (E13): markdown, прогресс чтения, голос.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_client/features/content/ui/article_screen.dart';
import 'package:app_client/l10n/app_localizations.dart';

class MockSqApi extends Mock implements SqApi {}

ContentItem _article() => ContentItem(
  id: 'c1',
  kind: ContentKind.article,
  access: ContentAccess.free,
  slug: 'anxiety-basics',
  category: 'anxiety',
  title: 'Как справиться с тревогой',
  summary: 'Кратко',
  positionPermille: 0,
  usefulYes: 10,
  usefulNo: 1,
  body: ArticleBody(
    markdown: List.generate(60, (i) => 'Абзац номер $i.').join('\n\n'),
  ),
);

Widget _wrap(SqApi api) => ProviderScope(
  overrides: [sqApiProvider.overrideWithValue(api)],
  child: const MaterialApp(
    locale: Locale('ru'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: ArticleScreen(id: 'c1'),
  ),
);

void main() {
  late MockSqApi api;

  setUp(() {
    api = MockSqApi();
    when(() => api.contentItem('c1')).thenAnswer((_) async => _article());
    when(() => api.saveContentProgress(any(), any())).thenAnswer(
      (_) async => const ContentProgress(positionPermille: 0, completed: false),
    );
    when(() => api.voteContent(any(), useful: any(named: 'useful'))).thenAnswer(
      (_) async => const ContentVotes(usefulYes: 11, usefulNo: 1),
    );
  });

  testWidgets('показывает заголовок и текст статьи', (tester) async {
    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    expect(find.text('Как справиться с тревогой'), findsOneWidget);
    expect(find.textContaining('Абзац номер 0.'), findsOneWidget);
  });

  testWidgets('прокрутка сохраняет прогресс чтения', (tester) async {
    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    await tester.drag(find.byType(Scrollable).first, const Offset(0, -4000));
    await tester.pumpAndSettle();

    final captured = verify(
      () => api.saveContentProgress('c1', captureAny()),
    ).captured;
    expect(captured.last as int, greaterThan(0));
  });

  testWidgets('«было полезно?» отправляет голос один раз за нажатие', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    // Кнопки под длинным текстом: ListView инфлейтит детей лениво, поэтому
    // до них надо доскроллить, а не искать в дереве.
    await tester.scrollUntilVisible(
      find.byKey(const Key('sq-content-useful-yes')),
      500,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('sq-content-useful-yes')));
    await tester.pumpAndSettle();

    verify(() => api.voteContent('c1', useful: true)).called(1);
  });

  testWidgets('на экране 411 dp ничего не переполняется', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.625;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
