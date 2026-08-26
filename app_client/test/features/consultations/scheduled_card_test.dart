// Плановая консультация в списке (E6b, задача 9): дата и время по Алматы,
// отсчёт до начала, «Войти в сессию» только у активной, предупреждение о
// поздней отмене — ДО подтверждения, а не постфактум.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

import 'package:app_client/features/consultations/ui/cancel_dialog.dart';
import 'package:app_client/features/consultations/ui/consultation_card.dart';
import 'package:app_client/l10n/app_localizations.dart';

ExpertPublic _expert() => const ExpertPublic(
  id: 'e1',
  displayName: 'Динара С.',
  city: 'Алматы',
  experience: ExperienceLevel.threeToFive,
  priceTiyn: 399000,
  languages: ['ru'],
  formats: [SessionFormat.chat],
  topicSlugs: ['anxiety-stress'],
  workStatus: WorkStatus.accepting,
  ratingAvg: 4.9,
  ratingCount: 312,
);

ClientConsultation _consultation({
  required ConsultationStatus status,
  required DateTime startedAt,
}) => ClientConsultation(
  id: 'c1',
  status: status,
  format: SessionFormat.chat,
  isEmergency: false,
  startedAt: startedAt,
  priceTiyn: 399000,
  plannedDurationMin: 50,
  paymentStatus: ConsultationPaymentStatus.held,
  expert: _expert(),
);

Widget _wrap(Widget child) => MaterialApp(
  locale: const Locale('ru'),
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  supportedLocales: AppLocalizations.supportedLocales,
  home: Scaffold(body: child),
);

void main() {
  testWidgets('плановая карточка показывает время, отсчёт и кнопку переноса', (
    tester,
  ) async {
    final now = DateTime.utc(2026, 8, 25, 4);
    await tester.pumpWidget(
      _wrap(
        ConsultationCard(
          consultation: _consultation(
            status: ConsultationStatus.scheduled,
            // 12:00 по Алматы, через два часа с четвертью.
            startedAt: DateTime.utc(2026, 8, 25, 6, 15),
          ),
          now: now,
          onTap: () {},
          onReschedule: () {},
          onCancel: () {},
        ),
      ),
    );

    expect(find.text('Запланирована'), findsOneWidget);
    expect(find.text('25.08.2026, 11:15'), findsOneWidget);
    expect(find.text('Через 2 ч 15 мин'), findsOneWidget);
    expect(
      find.byKey(const Key('sq-consultation-reschedule-c1')),
      findsOneWidget,
    );
    // Войти некуда: консультация ещё не началась.
    expect(find.byKey(const Key('sq-consultation-continue-c1')), findsNothing);
  });

  testWidgets('активная карточка показывает вход и не показывает отсчёт', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        ConsultationCard(
          consultation: _consultation(
            status: ConsultationStatus.active,
            startedAt: DateTime.utc(2026, 8, 25, 6),
          ),
          now: DateTime.utc(2026, 8, 25, 6, 5),
          onTap: () {},
          onContinue: () {},
        ),
      ),
    );

    expect(
      find.byKey(const Key('sq-consultation-continue-c1')),
      findsOneWidget,
    );
    expect(find.textContaining('Через'), findsNothing);
    expect(
      find.byKey(const Key('sq-consultation-reschedule-c1')),
      findsNothing,
    );
  });

  testWidgets('за полчаса до начала диалог отмены предупреждает о счётчике', (
    tester,
  ) async {
    late BuildContext ctx;
    await tester.pumpWidget(
      _wrap(
        Builder(
          builder: (context) {
            ctx = context;
            return const SizedBox.shrink();
          },
        ),
      ),
    );

    confirmCancelConsultation(ctx, minutesUntilStart: 30);
    await tester.pumpAndSettle();

    expect(
      find.textContaining('Три отмены за 30 дней отключают автоподбор'),
      findsOneWidget,
    );
  });

  testWidgets('за три часа предупреждения нет', (tester) async {
    late BuildContext ctx;
    await tester.pumpWidget(
      _wrap(
        Builder(
          builder: (context) {
            ctx = context;
            return const SizedBox.shrink();
          },
        ),
      ),
    );

    confirmCancelConsultation(ctx, minutesUntilStart: 180);
    await tester.pumpAndSettle();

    expect(
      find.textContaining('Три отмены за 30 дней отключают автоподбор'),
      findsNothing,
    );
  });
}
