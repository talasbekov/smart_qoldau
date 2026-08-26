// Оболочка веб-кабинета (E14, задача 2) — по прототипу
// `docs/Прототип/SmartQoldau Expert Web - Главная.dc.html`: тёмный сайдбар
// 260 px, восемь рабочих разделов сверху и служебные снизу.
//
// Четыре раздела прототипа (Клиенты, Чаты, Поддержка, Настройки) экранов
// в продукте не имеют — см. расхождение №10 в
// `brain/WIKI/Расхождения в прототипе.md`. Пункты, ведущие в «скоро
// будет», не рисуем: они обещают то, чего нет.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import 'package:app_expert/core/route_paths.dart';
import 'package:app_expert/features/shell/ui/expert_shell.dart';
import 'package:app_expert/l10n/app_localizations.dart';

// «Заявки» — отдельный раздел веб-кабинета (прототип `Expert Web -
// Заявки`). В мобильном приложении такого экрана нет: там оффер приходит
// полноэкранным алертом поверх любого маршрута (E7, задача 11).
const _sections = <String, String>{
  'offers': RoutePaths.offers,
  'consultations': RoutePaths.consultations,
  'schedule': RoutePaths.schedule,
  'earnings': RoutePaths.earnings,
  'reviews': RoutePaths.reviews,
  'notifications': RoutePaths.notifications,
  'profile': RoutePaths.profile,
};

Widget _wrap() {
  final router = GoRouter(
    initialLocation: RoutePaths.home,
    routes: [
      GoRoute(
        path: RoutePaths.home,
        builder: (context, state) =>
            const ExpertShell(child: Text('содержимое')),
      ),
      for (final path in _sections.values)
        GoRoute(
          path: path,
          builder: (context, state) => ExpertShell(child: Text('stub:$path')),
        ),
    ],
  );
  addTearDown(router.dispose);

  return ProviderScope(
    child: MaterialApp.router(
      routerConfig: router,
      locale: const Locale('ru'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
    ),
  );
}

Future<void> _pumpAt(WidgetTester tester, Size size) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(_wrap());
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('десктоп: сайдбар 260 px в цвете прототипа', (tester) async {
    await _pumpAt(tester, const Size(1440, 1024));

    final sidebar = find.byKey(const Key('sq-expert-sidebar'));
    expect(sidebar, findsOneWidget);
    expect(tester.getSize(sidebar).width, 260);

    // #0f3f3a прототипа — это SqColors.primaryDark дизайн-системы.
    final decorated = tester.widget<Container>(
      find.descendant(of: sidebar, matching: find.byType(Container)).first,
    );
    expect(
      (decorated.decoration as BoxDecoration?)?.color ?? decorated.color,
      SqColors.primaryDark,
    );
  });

  testWidgets('десктоп: все семь разделов прототипа, у которых есть экраны', (
    tester,
  ) async {
    await _pumpAt(tester, const Size(1440, 1024));

    for (final id in _sections.keys) {
      expect(
        find.byKey(Key('sq-nav-$id')),
        findsOneWidget,
        reason: 'раздел $id из прототипа',
      );
    }
  });

  testWidgets('разделов без экранов в меню нет', (tester) async {
    await _pumpAt(tester, const Size(1440, 1024));

    // Расхождение №10: обещать «Клиентов» и «Чаты» до решения продукта
    // нельзя, а «скоро будет» — худший вариант из возможных.
    for (final missing in ['clients', 'chats', 'support', 'settings']) {
      expect(find.byKey(Key('sq-nav-$missing')), findsNothing);
    }
  });

  testWidgets('выбор раздела ведёт по маршруту и подсвечивается', (
    tester,
  ) async {
    await _pumpAt(tester, const Size(1440, 1024));

    await tester.tap(find.byKey(const Key('sq-nav-earnings')));
    await tester.pumpAndSettle();

    expect(find.text('stub:${RoutePaths.earnings}'), findsOneWidget);
    expect(
      find.byKey(const Key('sq-nav-earnings-active')),
      findsOneWidget,
      reason: 'активный раздел выделен фоном, как в прототипе',
    );
  });

  testWidgets('телефон: сайдбара нет, раскладка прежняя', (tester) async {
    await _pumpAt(tester, const Size(390, 844));

    expect(find.byKey(const Key('sq-expert-sidebar')), findsNothing);
    expect(find.text('содержимое'), findsOneWidget);
  });

  testWidgets('планшет 900 dp: сайдбар узкий, только иконки', (tester) async {
    await _pumpAt(tester, const Size(900, 1200));

    final sidebar = find.byKey(const Key('sq-expert-sidebar'));
    expect(sidebar, findsOneWidget);
    // Подписи занимают место, которого на планшете нет: 260 px из 900 —
    // почти треть экрана.
    expect(tester.getSize(sidebar).width, lessThan(260));
  });

  testWidgets('на 1280 dp ничего не переполняется', (tester) async {
    await _pumpAt(tester, const Size(1280, 800));
    expect(tester.takeException(), isNull);
  });
}
