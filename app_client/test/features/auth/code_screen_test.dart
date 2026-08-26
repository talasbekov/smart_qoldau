// Виджет-тесты CodeScreen: автоподтверждение по 6-й цифре, локализованный
// текст ошибки SMS_CODE_INVALID и 45-секундный обратный отсчёт повторной
// отправки (Р-10/ТЗ §5.1). Сеть заменена моком SqApi (mocktail).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_client/core/providers.dart';
import 'package:app_client/core/token_store.dart';
import 'package:app_client/features/auth/ui/code_screen.dart';
import 'package:app_client/l10n/app_localizations.dart';

class MockSqApi extends Mock implements SqApi {}

class _FakeSecureStore implements SecureStore {
  final Map<String, String> data = {};

  @override
  Future<String?> read(String key) async => data[key];

  @override
  Future<void> write(String key, String value) async => data[key] = value;

  @override
  Future<void> delete(String key) async => data.remove(key);
}

const _phone = '+77011234567';

Tokens _tokens() => const Tokens(
  accessToken: 'access',
  refreshToken: 'refresh',
  user: AuthUser(id: 'u1', phone: _phone, isGuest: false),
);

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

Future<void> _enterCode(WidgetTester tester, String code) async {
  final fields = find.byType(TextField);
  for (var i = 0; i < code.length; i++) {
    await tester.enterText(fields.at(i), code[i]);
  }
}

void main() {
  setUpAll(() {
    registerFallbackValue(_phone);
  });

  testWidgets('ввод 6 цифр вызывает verifyCode ровно один раз', (tester) async {
    final api = MockSqApi();
    when(() => api.verifyCode(any(), any())).thenAnswer((_) async => _tokens());

    await tester.pumpWidget(_wrap(api, const CodeScreen(phone: _phone)));
    await _enterCode(tester, '123456');
    await tester.pumpAndSettle();

    verify(() => api.verifyCode(_phone, '123456')).called(1);
  });

  testWidgets('SMS_CODE_INVALID показывает локализованный текст ошибки', (
    tester,
  ) async {
    final api = MockSqApi();
    when(() => api.verifyCode(any(), any())).thenThrow(
      const ApiException(ApiErrorCode.smsCodeInvalid, 'bad code', 400),
    );

    await tester.pumpWidget(_wrap(api, const CodeScreen(phone: _phone)));
    await _enterCode(tester, '123456');
    await tester.pumpAndSettle();

    final l10n = AppLocalizations.of(tester.element(find.byType(CodeScreen)))!;
    expect(find.text(l10n.errorSmsCodeInvalid), findsOneWidget);
  });

  testWidgets(
    'кнопка "Отправить повторно" заблокирована 45с и разблокируется после отсчёта',
    (tester) async {
      final api = MockSqApi();
      when(() => api.requestCode(any())).thenAnswer((_) async {});

      await tester.pumpWidget(_wrap(api, const CodeScreen(phone: _phone)));

      TextButton resendButton() =>
          tester.widget<TextButton>(find.byType(TextButton));

      expect(resendButton().onPressed, isNull);

      await tester.pump(const Duration(seconds: 45));

      expect(resendButton().onPressed, isNotNull);
    },
  );

  // Шесть ячеек вместо четырёх: ряд обязан помещаться и на самом узком
  // распространённом экране (360 dp), иначе Flutter рисует полосатый
  // overflow вместо поля ввода.
  testWidgets('ряд из шести ячеек помещается на экране 360 dp', (tester) async {
    tester.view.physicalSize = const Size(360, 690);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final api = MockSqApi();
    await tester.pumpWidget(_wrap(api, const CodeScreen(phone: _phone)));
    await tester.pumpAndSettle();

    expect(find.byType(TextField), findsNWidgets(6));
    expect(tester.takeException(), isNull);
  });
}
