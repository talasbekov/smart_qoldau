// Виджет-тесты ExpertReviewsScreen (E7 задача 15): кнопки «Ответить» и
// «Пожаловаться» доводят текст из диалога до API, ошибка бэкенда
// показывается snackbar'ом и не роняет ленту, пустой текст отправить
// нельзя (бэкенд отверг бы его как VALIDATION_FAILED).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_expert/features/reviews/ui/expert_reviews_screen.dart';
import 'package:app_expert/l10n/app_localizations.dart';

class MockSqApi extends Mock implements SqApi {}

MyExpertReviews _reviews({String? expertReply}) => MyExpertReviews(
  items: [
    OwnReviewItem(
      id: 'rev-1',
      rating: 5,
      publicText: 'Очень помогло',
      expertReply: expertReply,
      createdAt: DateTime(2026, 8, 1),
    ),
  ],
  distribution: const RatingDistribution(
    rating1: 0,
    rating2: 0,
    rating3: 0,
    rating4: 1,
    rating5: 4,
  ),
  ratingAvg: 4.8,
  ratingCount: 5,
);

Widget _wrap(SqApi api) => ProviderScope(
  overrides: [sqApiProvider.overrideWithValue(api)],
  child: MaterialApp(
    locale: const Locale('ru'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: const ExpertReviewsScreen(),
  ),
);

void main() {
  late MockSqApi api;

  setUp(() {
    api = MockSqApi();
  });

  testWidgets('«Ответить» отправляет текст в POST /reviews/{id}/reply', (
    tester,
  ) async {
    var replied = false;
    when(() => api.myReviews(take: null, skip: null)).thenAnswer(
      (_) async => _reviews(expertReply: replied ? 'Спасибо!' : null),
    );
    when(() => api.replyToReview('rev-1', 'Спасибо!')).thenAnswer((_) async {
      replied = true;
    });

    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('sq-review-reply-rev-1')));
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('sq-review-text')), 'Спасибо!');
    await tester.tap(find.byKey(const Key('sq-review-text-confirm')));
    await tester.pumpAndSettle();

    verify(() => api.replyToReview('rev-1', 'Спасибо!')).called(1);
    expect(find.text('Ответ сохранён'), findsOneWidget);
    // Лента перечитана — ответ виден в карточке.
    expect(find.text('Спасибо!'), findsWidgets);
  });

  testWidgets(
    '«Пожаловаться» отправляет текст в POST /reviews/{id}/complaint',
    (tester) async {
      when(() => api.myReviews(take: null, skip: null))
          .thenAnswer((_) async => _reviews());
      when(() => api.complainAboutReview('rev-1', 'не по делу'))
          .thenAnswer((_) async {});

      await tester.pumpWidget(_wrap(api));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('sq-review-complaint-rev-1')));
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byKey(const Key('sq-review-text')),
        'не по делу',
      );
      await tester.tap(find.byKey(const Key('sq-review-text-confirm')));
      await tester.pumpAndSettle();

      verify(() => api.complainAboutReview('rev-1', 'не по делу')).called(1);
      expect(find.textContaining('Жалоба отправлена'), findsOneWidget);
    },
  );

  testWidgets('пустой текст отправить нельзя — диалог остаётся открытым', (
    tester,
  ) async {
    when(() => api.myReviews(take: null, skip: null))
        .thenAnswer((_) async => _reviews());

    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('sq-review-reply-rev-1')));
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('sq-review-text')), '   ');
    await tester.tap(find.byKey(const Key('sq-review-text-confirm')));
    await tester.pumpAndSettle();

    verifyNever(() => api.replyToReview(any(), any()));
    expect(find.byKey(const Key('sq-review-text')), findsOneWidget);
  });

  testWidgets('409 от бэкенда показывается snackbar\'ом, лента остаётся', (
    tester,
  ) async {
    when(() => api.myReviews(take: null, skip: null))
        .thenAnswer((_) async => _reviews());
    when(() => api.replyToReview('rev-1', 'поздно')).thenThrow(
      const ApiException(
        ApiErrorCode.invalidStateTransition,
        'Ответ можно оставить только на опубликованный отзыв',
        409,
      ),
    );

    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('sq-review-reply-rev-1')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('sq-review-text')), 'поздно');
    await tester.tap(find.byKey(const Key('sq-review-text-confirm')));
    await tester.pumpAndSettle();

    expect(
      find.text('Ответ можно оставить только на опубликованный отзыв'),
      findsOneWidget,
    );
    expect(find.text('Очень помогло'), findsOneWidget);
  });

  testWidgets(
    'на отзыв с ответом кнопка называется «Изменить ответ» и предзаполняет текст',
    (tester) async {
      when(() => api.myReviews(take: null, skip: null))
          .thenAnswer((_) async => _reviews(expertReply: 'Старый ответ'));

      await tester.pumpWidget(_wrap(api));
      await tester.pumpAndSettle();

      expect(find.text('Изменить ответ'), findsOneWidget);

      await tester.tap(find.byKey(const Key('sq-review-reply-rev-1')));
      await tester.pumpAndSettle();

      final field = tester.widget<TextField>(
        find.byKey(const Key('sq-review-text')),
      );
      expect(field.controller?.text, 'Старый ответ');
    },
  );
}
