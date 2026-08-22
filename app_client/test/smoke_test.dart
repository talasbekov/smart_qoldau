import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:app_client/app.dart';

void main() {
  testWidgets('SqClientApp renders a MaterialApp', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const SqClientApp());

    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
