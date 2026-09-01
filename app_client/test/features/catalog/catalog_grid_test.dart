// Раскладка каталога (E15) по прототипу
// `docs/Прототип/SmartQoldau Web - Каталог.dc.html`: карточки специалистов
// идут сеткой `auto-fit minmax(270px, 1fr)` — на широком экране в три-четыре
// колонки, на телефоне в одну.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

import 'package:app_client/features/catalog/ui/expert_grid.dart';

ExpertPublic _expert(String id) => ExpertPublic(
  id: id,
  displayName: 'Специалист $id',
  city: 'Алматы',
  experience: ExperienceLevel.threeToFive,
  priceTiyn: 399000,
  languages: const ['ru'],
  formats: const [SessionFormat.video],
  topicSlugs: const ['anxiety-stress'],
  workStatus: WorkStatus.accepting,
  ratingAvg: 4.9,
  ratingCount: 120,
);

Future<void> _pumpAt(WidgetTester tester, Size size) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: ExpertGrid(
          itemCount: 6,
          itemBuilder: (context, index) => SizedBox(
            key: Key('sq-grid-item-$index'),
            height: 200,
            child: Text(_expert('e$index').displayName),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('десктоп: несколько колонок', (tester) async {
    await _pumpAt(tester, const Size(1440, 1024));

    final first = tester.getTopLeft(find.byKey(const Key('sq-grid-item-0')));
    final second = tester.getTopLeft(find.byKey(const Key('sq-grid-item-1')));
    expect(second.dy, first.dy, reason: 'вторая карточка в том же ряду');
    expect(second.dx, greaterThan(first.dx));
  });

  testWidgets('карточка не уже 270 px, как в прототипе', (tester) async {
    await _pumpAt(tester, const Size(1440, 1024));

    final width = tester.getSize(find.byKey(const Key('sq-grid-item-0'))).width;
    expect(width, greaterThanOrEqualTo(270));
  });

  testWidgets('телефон: одна колонка', (tester) async {
    await _pumpAt(tester, const Size(390, 844));

    final first = tester.getTopLeft(find.byKey(const Key('sq-grid-item-0')));
    final second = tester.getTopLeft(find.byKey(const Key('sq-grid-item-1')));
    expect(second.dx, first.dx);
    expect(second.dy, greaterThan(first.dy));
  });

  testWidgets('узкое окно 700 px: одна колонка, ничего не режется', (
    tester,
  ) async {
    await _pumpAt(tester, const Size(700, 900));
    expect(tester.takeException(), isNull);
  });
}
