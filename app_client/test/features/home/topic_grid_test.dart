// Сетка тем (E15) по прототипу `SmartQoldau Web - Выбор темы`:
// `auto-fit minmax(210px, 1fr)`. На телефоне это прежние три колонки,
// на широком экране — больше, а не три плитки во весь монитор.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

import 'package:app_client/features/home/ui/topic_grid.dart';

List<Topic> _topics(int n) => [
  for (var i = 0; i < n; i++)
    Topic(id: 't$i', slug: 'topic-$i', name: 'Тема $i'),
];

Future<int> _columnsAt(WidgetTester tester, Size size) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          child: TopicGrid(topics: _topics(12), onTopicTap: (_) {}),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();

  // Сколько плиток в первом ряду: у них совпадает верхняя координата.
  final firstTop = tester
      .getTopLeft(find.byKey(const Key('sq-topic-topic-0')))
      .dy;
  var columns = 0;
  for (var i = 0; i < 12; i++) {
    final finder = find.byKey(Key('sq-topic-topic-$i'));
    if (finder.evaluate().isEmpty) break;
    if (tester.getTopLeft(finder).dy == firstTop) columns++;
  }
  return columns;
}

void main() {
  testWidgets('телефон: три колонки, как было', (tester) async {
    expect(await _columnsAt(tester, const Size(390, 844)), 3);
  });

  testWidgets('десктоп: колонок больше трёх', (tester) async {
    expect(await _columnsAt(tester, const Size(1440, 1024)), greaterThan(3));
  });

  testWidgets('плитка не уже 210 px на широком экране', (tester) async {
    tester.view.physicalSize = const Size(1440, 1024);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: TopicGrid(topics: _topics(12), onTopicTap: (_) {}),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final width = tester
        .getSize(find.byKey(const Key('sq-topic-topic-0')))
        .width;
    expect(width, greaterThanOrEqualTo(210));
  });
}
