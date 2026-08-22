// Виджет-тест PhoneScreen: кнопка активна только при полных 11 цифрах
// маски, наружу уходит нормализованный `+77XXXXXXXXX`.
//
// Добавлен сверх минимального списка тестов брифа задачи 5 — при
// самопроверке обнаружился реальный баг в подсчёте цифр (маска пишет
// фиксированные «77» прямо в текст поля, а не только в декорацию, поэтому
// сравнивать общее число цифр в тексте с 9 набранными пользователем было
// неверно: кнопка никогда не разблокировалась). Тест фиксирует
// исправленное поведение.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_client/core/providers.dart';
import 'package:app_client/core/token_store.dart';
import 'package:app_client/features/auth/ui/code_screen.dart';
import 'package:app_client/features/auth/ui/phone_screen.dart';
import 'package:app_client/l10n/app_localizations.dart';

class MockSqApi extends Mock implements SqApi {}

class _FakeSecureStore implements SecureStore {
  @override
  Future<String?> read(String key) async => null;

  @override
  Future<void> write(String key, String value) async {}

  @override
  Future<void> delete(String key) async {}
}

Widget _wrap(SqApi api, Widget child) {
  return ProviderScope(
    overrides: [
      sqApiProvider.overrideWithValue(api),
      secureStoreProvider.overrideWithValue(_FakeSecureStore()),
    ],
    child: MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: child,
    ),
  );
}

void main() {
  setUpAll(() {
    registerFallbackValue('+77011234567');
  });

  testWidgets('кнопка неактивна, пока не введены все 9 цифр номера', (
    tester,
  ) async {
    final api = MockSqApi();
    await tester.pumpWidget(_wrap(api, const PhoneScreen()));

    await tester.enterText(find.byType(TextField), '70123456');
    await tester.pump();

    final button = tester.widget<InkWell>(find.byType(InkWell));
    expect(button.onTap, isNull);
  });

  testWidgets('при 9 набранных цифрах кнопка активна и шлёт +77XXXXXXXXX', (
    tester,
  ) async {
    final api = MockSqApi();
    when(() => api.requestCode(any())).thenAnswer((_) async {});

    await tester.pumpWidget(_wrap(api, const PhoneScreen()));

    await tester.enterText(find.byType(TextField), '701234567');
    await tester.pump();

    final button = tester.widget<InkWell>(find.byType(InkWell));
    expect(button.onTap, isNotNull);

    button.onTap!();
    await tester.pumpAndSettle();

    verify(() => api.requestCode('+77701234567')).called(1);
    expect(find.byType(CodeScreen), findsOneWidget);
  });
}
