import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

/// Оборачивает виджет в минимальное дерево, достаточное для рендера
/// (Material-контекст + тема пакета).
Widget _wrap(Widget child) {
  return MaterialApp(
    theme: sqTheme(),
    home: Scaffold(body: Center(child: child)),
  );
}

void main() {
  group('SqColors', () {
    test('matches the prototype hex values', () {
      expect(SqColors.primary, const Color(0xFF0F766E));
      expect(SqColors.primaryDark, const Color(0xFF0F3F3A));
      expect(SqColors.accent, const Color(0xFF159A7C));
      expect(SqColors.danger, const Color(0xFFC0392B));
      expect(SqColors.background, const Color(0xFFFAFCFB));
      expect(SqColors.surface, const Color(0xFFFFFFFF));
      expect(SqColors.surfaceMuted, const Color(0xFFEDF2F0));
      expect(SqColors.chipBg, const Color(0xFFE3F3EE));
      expect(SqColors.border, const Color(0xFFC7D3CF));
      expect(SqColors.textPrimary, const Color(0xFF0F3F3A));
      expect(SqColors.textSecondary, const Color(0xFF6B8580));
      expect(SqColors.textTertiary, const Color(0xFF8FA6A1));
    });
  });

  group('SqSpacing and SqRadius', () {
    test('match the prototype scale', () {
      expect(SqSpacing.xs, 4);
      expect(SqSpacing.s, 8);
      expect(SqSpacing.m, 12);
      expect(SqSpacing.l, 16);
      expect(SqSpacing.xl, 24);
      expect(SqSpacing.xxl, 32);

      expect(SqRadius.s, 8);
      expect(SqRadius.m, 12);
      expect(SqRadius.l, 16);
      expect(SqRadius.pill, 999);
    });
  });

  group('sqTheme', () {
    test('is a light theme using the prototype background color', () {
      final theme = sqTheme();
      expect(theme.brightness, Brightness.light);
      expect(theme.scaffoldBackgroundColor, SqColors.background);
    });
  });

  group('SqButton', () {
    testWidgets('shows a loading indicator and ignores taps while loading', (
      tester,
    ) async {
      var tapped = 0;
      await tester.pumpWidget(
        _wrap(
          SqButton(
            label: 'Отправить',
            loading: true,
            onPressed: () => tapped++,
          ),
        ),
      );

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('Отправить'), findsNothing);

      await tester.tap(find.byType(SqButton));
      await tester.pump();

      expect(tapped, 0);
    });

    testWidgets(
      'paints the background in SqColors.danger for the danger kind',
      (tester) async {
        await tester.pumpWidget(
          _wrap(const SqButton(label: 'Удалить', kind: SqButtonKind.danger)),
        );

        final container = tester.widget<Container>(
          find
              .descendant(
                of: find.byType(SqButton),
                matching: find.byType(Container),
              )
              .first,
        );
        final decoration = container.decoration as BoxDecoration;
        expect(decoration.color, SqColors.danger);
      },
    );

    testWidgets('calls onPressed when tapped and not loading', (tester) async {
      var tapped = 0;
      await tester.pumpWidget(
        _wrap(SqButton(label: 'ОК', onPressed: () => tapped++)),
      );

      await tester.tap(find.byType(SqButton));
      await tester.pump();

      expect(tapped, 1);
    });
  });

  group('SqTextField', () {
    testWidgets('shows label and hint and reports the typed value', (
      tester,
    ) async {
      String? typed;
      await tester.pumpWidget(
        _wrap(
          SqTextField(
            label: 'Имя',
            hint: 'Введите имя',
            onChanged: (value) => typed = value,
          ),
        ),
      );

      expect(find.text('Имя'), findsOneWidget);
      expect(find.text('Введите имя'), findsOneWidget);

      await tester.enterText(find.byType(TextField), 'Дана');
      expect(typed, 'Дана');
    });

    testWidgets(
      'passes inputFormatters through to the inner TextField — маски (номер '
      'карты, телефон) живут в экранах, дизайн-система только несёт их',
      (tester) async {
        final controller = TextEditingController();
        addTearDown(controller.dispose);

        await tester.pumpWidget(
          _wrap(
            SqTextField(
              controller: controller,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(4),
              ],
            ),
          ),
        );

        await tester.enterText(find.byType(TextField), 'a1b2c3d4e5');

        expect(controller.text, '1234');
      },
    );

    testWidgets('shows the error message when errorText is set', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(const SqTextField(errorText: 'Обязательное поле')),
      );

      expect(find.text('Обязательное поле'), findsOneWidget);
    });
  });

  group('SqCard', () {
    testWidgets('renders its child on a surface background', (tester) async {
      await tester.pumpWidget(
        _wrap(const SqCard(child: Text('Контент карточки'))),
      );

      expect(find.text('Контент карточки'), findsOneWidget);

      final container = tester.widget<Container>(
        find
            .descendant(
              of: find.byType(SqCard),
              matching: find.byType(Container),
            )
            .first,
      );
      expect((container.decoration as BoxDecoration).color, SqColors.surface);
    });
  });

  group('SqChip', () {
    testWidgets('shows the label', (tester) async {
      await tester.pumpWidget(_wrap(const SqChip(label: 'Тревога')));
      expect(find.text('Тревога'), findsOneWidget);
    });

    testWidgets('paints a different background when selected', (tester) async {
      await tester.pumpWidget(
        _wrap(const SqChip(label: 'Сон', selected: false)),
      );
      final unselected =
          tester
                  .widget<Container>(
                    find
                        .descendant(
                          of: find.byType(SqChip),
                          matching: find.byType(Container),
                        )
                        .first,
                  )
                  .decoration
              as BoxDecoration;

      await tester.pumpWidget(
        _wrap(const SqChip(label: 'Сон', selected: true)),
      );
      final selected =
          tester
                  .widget<Container>(
                    find
                        .descendant(
                          of: find.byType(SqChip),
                          matching: find.byType(Container),
                        )
                        .first,
                  )
                  .decoration
              as BoxDecoration;

      expect(unselected.color, SqColors.chipBg);
      expect(selected.color, SqColors.primary);
    });
  });

  group('SqAvatar', () {
    testWidgets('renders initials from a full name', (tester) async {
      await tester.pumpWidget(_wrap(const SqAvatar(name: 'Айгуль С.')));
      expect(find.text('АС'), findsOneWidget);
    });

    testWidgets('background color is deterministic for the same name', (
      tester,
    ) async {
      await tester.pumpWidget(_wrap(const SqAvatar(name: 'Тимур Ахметов')));
      final first =
          tester.widget<Container>(find.byType(Container).first).decoration
              as BoxDecoration;

      await tester.pumpWidget(_wrap(const SqAvatar(name: 'Тимур Ахметов')));
      final second =
          tester.widget<Container>(find.byType(Container).first).decoration
              as BoxDecoration;

      expect(first.color, second.color);
    });
  });

  group('SqRatingStars', () {
    testWidgets('renders filled and empty stars according to value', (
      tester,
    ) async {
      await tester.pumpWidget(_wrap(const SqRatingStars(value: 4, count: 5)));

      expect(find.byIcon(Icons.star), findsNWidgets(4));
      expect(find.byIcon(Icons.star_border), findsNWidgets(1));
    });

    testWidgets('defaults to a 5-star scale', (tester) async {
      await tester.pumpWidget(_wrap(const SqRatingStars(value: 0)));
      expect(find.byIcon(Icons.star_border), findsNWidgets(5));
    });
  });

  group('SqEmptyState', () {
    testWidgets('shows the title and the optional subtitle', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const SqEmptyState(title: 'Пока пусто', subtitle: 'Записей ещё нет'),
        ),
      );

      expect(find.text('Пока пусто'), findsOneWidget);
      expect(find.text('Записей ещё нет'), findsOneWidget);
    });
  });

  group('SqErrorView', () {
    testWidgets('shows the error text and calls onRetry when tapped', (
      tester,
    ) async {
      var retried = 0;
      await tester.pumpWidget(
        _wrap(
          SqErrorView(text: 'Не удалось загрузить', onRetry: () => retried++),
        ),
      );

      expect(find.text('Не удалось загрузить'), findsOneWidget);

      await tester.tap(find.text('Повторить'));
      await tester.pump();

      expect(retried, 1);
    });

    testWidgets(
      'uses a custom retryLabel when the caller needs localization '
      '(shared cannot depend on an app l10n, so retryLabel is the way an '
      'app-specific translation reaches this button)',
      (tester) async {
        await tester.pumpWidget(
          _wrap(
            SqErrorView(
              text: 'Қате шықты',
              onRetry: () {},
              retryLabel: 'Қайталау',
            ),
          ),
        );

        expect(find.text('Қайталау'), findsOneWidget);
        expect(find.text('Повторить'), findsNothing);
      },
    );

    testWidgets('hides the retry action when onRetry is null', (tester) async {
      await tester.pumpWidget(_wrap(const SqErrorView(text: 'Ошибка')));
      expect(find.text('Повторить'), findsNothing);
    });
  });

  group('SqLoader', () {
    testWidgets('renders a progress indicator', (tester) async {
      await tester.pumpWidget(_wrap(const SqLoader()));
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });
  });

  group('SqEmergencyDisclaimer', () {
    testWidgets('shows the disclaimer text and both emergency numbers', (
      tester,
    ) async {
      await tester.pumpWidget(_wrap(const SqEmergencyDisclaimer()));

      expect(
        find.textContaining('Платформа не заменяет экстренные службы'),
        findsOneWidget,
      );
      expect(find.textContaining('102'), findsOneWidget);
      expect(find.textContaining('103'), findsOneWidget);
    });

    testWidgets(
      'uses a custom disclaimerText when the caller needs localization '
      '(shared cannot depend on an app l10n, so disclaimerText is the way '
      'an app-specific translation reaches this text)',
      (tester) async {
        await tester.pumpWidget(
          _wrap(
            const SqEmergencyDisclaimer(
              disclaimerText: 'Платформа шұғыл қызметтерді алмастырмайды.',
            ),
          ),
        );

        expect(
          find.text('Платформа шұғыл қызметтерді алмастырмайды.'),
          findsOneWidget,
        );
        expect(
          find.textContaining('Платформа не заменяет экстренные службы'),
          findsNothing,
        );
      },
    );

    testWidgets('invokes the matching callback per emergency number', (
      tester,
    ) async {
      var called102 = 0;
      var called103 = 0;
      await tester.pumpWidget(
        _wrap(
          SqEmergencyDisclaimer(
            onCall102: () => called102++,
            onCall103: () => called103++,
          ),
        ),
      );

      await tester.tap(find.widgetWithText(SqButton, '102'));
      await tester.pump();
      await tester.tap(find.widgetWithText(SqButton, '103'));
      await tester.pump();

      expect(called102, 1);
      expect(called103, 1);
    });
  });
}
