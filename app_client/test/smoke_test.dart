import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:app_client/app.dart';
import 'package:app_client/core/locale_controller.dart';

void main() {
  testWidgets('SqClientApp renders a themed MaterialApp', (
    WidgetTester tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [sharedPreferencesProvider.overrideWithValue(prefs)],
        child: const SqClientApp(),
      ),
    );

    expect(find.byType(MaterialApp), findsOneWidget);

    final materialApp = tester.widget<MaterialApp>(find.byType(MaterialApp));
    expect(materialApp.theme, isNotNull);
    expect(materialApp.theme!.scaffoldBackgroundColor, SqColors.background);
  });
}
