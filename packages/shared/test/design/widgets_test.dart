import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
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
  setUpAll(() {
    // Тестовое окружение не имеет доступа к сети: без этого флага
    // google_fonts пытается скачать Inter по HTTP при каждом обращении
    // к шрифту, которого ещё нет в кеше пакета.
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  // google_fonts НЕ кеширует провалившиеся попытки загрузки шрифта — кеш
  // (`_loadedFonts`) чистится в catch-блоке при любой ошибке, кешируются
  // только успешные загрузки (см. его исходники и
  // load_font_if_necessary_test.dart, кейс "does not call http if config is
  // false"). Поэтому `GoogleFonts.inter()`, вызванный на каждый ребилд
  // виджета, при `allowRuntimeFetching = false` печатал бы через debugPrint
  // предупреждение "unable to load font ... not found in the application
  // assets" на КАЖДОМ тесте — фактическая защита от этого шума не в
  // прогреве, а в `SqTypography`/`sqTheme()` (`packages/shared/lib/design/
  // tokens.dart`, `theme.dart`): там `GoogleFonts.inter()` теперь
  // вычисляется один раз и мемоизируется (`static final` / кеш ThemeData),
  // так что за весь прогон файла он реально вызывается ровно по одному разу
  // на начертание (w400/w600/w700 — всё, что использует SqTypography).
  //
  // Прогрев ниже — единственное место, где это единоразовое обращение
  // происходит; здесь же оно перехватывается и проверяется. Глушим именно
  // Zone.print (а не глобальный `debugPrint`): переопределять сам
  // `debugPrint` в тестах с виджетами нельзя, тестовый биндинг Flutter
  // проверяет после каждого testWidgets, что debug-переменные foundation
  // не изменены, и падает на инварианте, если это не так.
  //
  // Важная деталь окружения (см. фикс-репорт в task-2-report.md): в тестах
  // Flutter-*пакета* (не приложения) `path_provider` не зарегистрирован —
  // обращение к его platform channel без мока никогда не отвечает, и
  // google_fonts, ожидая ответ перед тем как проверить оффлайн-кеш на
  // диске, зависает в фоне и не доходит до debugPrint в течение жизни
  // теста. Из-за этого раньше прогрев мог казаться «сработавшим» просто
  // потому, что предупреждение никогда не печаталось в принципе — это
  // делало проверку недостоверной. Мокаем канал `path_provider`, чтобы
  // google_fonts детерминированно и быстро доходил до реальной ветки
  // «офлайн, локального кеша нет», и подавление с проверкой ниже
  // действительно что-то тестировали, а не полагались на гонку.
  //
  // Ограничение: этот прогрев — единственное место, где происходит
  // единоразовый вызов. Выборочный прогон (`flutter test --plain-name
  // "SqButton"`), который его исключает, увидит непрогретое предупреждение.
  // Полное требование «вывод чист» проверяется прогоном всего файла/пакета.
  testWidgets(
    'прогревает кеш google_fonts и подтверждает, что подавляется именно '
    'его офлайн-предупреждение',
    (tester) async {
      const pathProviderChannel = MethodChannel(
        'plugins.flutter.io/path_provider',
      );
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        pathProviderChannel,
        (call) async => Directory.systemTemp.path,
      );
      // Автоматическая пост-тестовая уборка Flutter не снимает хендлеры,
      // установленные автором теста на произвольных каналах (она сбрасывает
      // только то, что ставит сама) — снимаем его явно, иначе он молча
      // провисит на все оставшиеся тесты файла и подменит path_provider
      // любому будущему тесту, которому понадобится настоящий провайдер.
      addTearDown(
        () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
          pathProviderChannel,
          null,
        ),
      );

      final suppressed = <String>[];
      final quietZone = ZoneSpecification(
        print: (self, parent, zone, message) {
          suppressed.add(message);
        },
      );
      await Zone.current.fork(specification: quietZone).run(() async {
        await tester.pumpWidget(_wrap(const SizedBox.shrink()));
        // pumpAndSettle, а не одиночный pump: реальный round-trip через
        // мокнутый platform channel может занять больше одного цикла
        // микрозадач, а debugPrint из google_fonts должен долистаться
        // именно внутри этой заглушённой Zone, а не в следующем тесте.
        await tester.pumpAndSettle();
      });

      // Канарейка: если google_fonts перестанет печатать это предупреждение
      // (например, поменяется формат сообщения или логика кеширования при
      // апдейте пакета), проверки ниже покраснеют вместо того, чтобы
      // молча перестать что-либо ловить.
      expect(
        suppressed,
        isNotEmpty,
        reason:
            'ожидали хотя бы одно подавленное сообщение офлайн-фолбэка '
            'google_fonts',
      );
      expect(
        suppressed.any(
          (message) => message.contains('google_fonts was unable to load font'),
        ),
        isTrue,
        reason:
            'ожидали характерное сообщение google_fonts об отсутствии '
            'шрифта в assets; его текст мог поменяться при апдейте пакета',
      );
    },
  );

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
