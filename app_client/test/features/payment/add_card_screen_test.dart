// Виджет-тесты экрана добавления карты (Step 2 брифа задачи 12): маска
// номера, проверка Луна ДО отправки и валидация срока/имени.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_client/core/route_paths.dart';
import 'package:app_client/features/payment/ui/add_card_screen.dart';
import 'package:app_client/l10n/app_localizations.dart';

class MockSqApi extends Mock implements SqApi {}

Widget _wrap(SqApi api) {
  final router = GoRouter(
    initialLocation: RoutePaths.cardsAdd,
    routes: [
      GoRoute(
        path: RoutePaths.cardsAdd,
        builder: (context, state) => const AddCardScreen(),
      ),
      GoRoute(
        path: RoutePaths.cards,
        builder: (context, state) =>
            const Scaffold(body: Text('sq-stub-cards')),
      ),
    ],
  );
  addTearDown(router.dispose);

  return ProviderScope(
    overrides: [sqApiProvider.overrideWithValue(api)],
    child: MaterialApp.router(
      routerConfig: router,
      locale: const Locale('ru'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
    ),
  );
}

/// Внутренний `TextField` поля дизайн-системы: ключи стоят на `SqTextField`,
/// а вводить текст и читать состояние нужно у самого `TextField`.
Finder _input(Finder field) =>
    find.descendant(of: field, matching: find.byType(TextField));

String _textOf(WidgetTester tester, Finder field) =>
    tester.widget<TextField>(_input(field)).controller!.text;

/// Ввод ПОСИМВОЛЬНО (урок 2 плана эпика): единственный `enterText` прошёл
/// бы мимо сломанной маски, как это было в задаче 5 с телефоном.
Future<void> _typeInto(WidgetTester tester, Finder field, String value) async {
  final input = _input(field);
  await tester.tap(input);
  await tester.pump();
  for (final char in value.split('')) {
    await tester.enterText(input, '${_textOf(tester, field)}$char');
    await tester.pump();
  }
}

void main() {
  late MockSqApi api;

  final numberField = find.byKey(const Key('sq-card-number'));
  final expiryField = find.byKey(const Key('sq-card-expiry'));
  final holderField = find.byKey(const Key('sq-card-holder'));

  setUp(() {
    api = MockSqApi();
    when(
      () => api.addPaymentMethod(
        pan: any(named: 'pan'),
        expiry: any(named: 'expiry'),
        holderName: any(named: 'holderName'),
      ),
    ).thenAnswer(
      (_) async => const PaymentMethod(
        id: 'pm1',
        maskedPan: '**** 4242',
        brand: 'VISA',
        holderName: 'IVAN IVANOV',
      ),
    );
  });

  testWidgets('номер группируется по 4 при посимвольном вводе', (tester) async {
    await tester.pumpWidget(_wrap(api));
    await tester.pump();

    await _typeInto(tester, numberField, '4242424242424242');

    expect(_textOf(tester, numberField), '4242 4242 4242 4242');
  });

  testWidgets('после 16-й цифры фокус остаётся в поле номера', (
    tester,
  ) async {
    // Бэкенд принимает PAN длиной 12–19 (`AddPaymentMethodDto`).
    // Авто-переход фокуса на 16-й цифре увёл бы хвост 17–19 в поле срока
    // действия — у владельца такой карты форма ломалась бы молча, а тест,
    // который пишет в поле напрямую (`enterText` сам ставит фокус), этого
    // не заметил бы: наблюдать надо именно фокус.
    await tester.pumpWidget(_wrap(api));
    await tester.pump();

    await _typeInto(tester, numberField, '6759649826438453');

    expect(
      tester.widget<TextField>(_input(numberField)).focusNode!.hasFocus,
      isTrue,
      reason: 'карты бывают длиннее 16 цифр — фокус уводить нельзя',
    );
    expect(_textOf(tester, expiryField), isEmpty);
  });

  testWidgets('номер, не проходящий Луна, не уходит в сеть', (tester) async {
    await tester.pumpWidget(_wrap(api));
    await tester.pump();

    await _typeInto(tester, numberField, '4242424242424243');
    await _typeInto(tester, expiryField, '1229');
    await _typeInto(tester, holderField, 'IVAN IVANOV');

    await tester.tap(find.text('Сохранить'));
    await tester.pumpAndSettle();

    expect(find.text('Проверьте номер карты'), findsOneWidget);
    verifyNever(
      () => api.addPaymentMethod(
        pan: any(named: 'pan'),
        expiry: any(named: 'expiry'),
        holderName: any(named: 'holderName'),
      ),
    );
  });

  testWidgets('корректная карта уходит без пробелов в PAN', (tester) async {
    await tester.pumpWidget(_wrap(api));
    await tester.pump();

    await _typeInto(tester, numberField, '4242424242424242');
    await _typeInto(tester, expiryField, '1229');
    await _typeInto(tester, holderField, 'IVAN IVANOV');

    await tester.tap(find.text('Сохранить'));
    await tester.pumpAndSettle();

    verify(
      () => api.addPaymentMethod(
        pan: '4242424242424242',
        expiry: '12/29',
        holderName: 'IVAN IVANOV',
      ),
    ).called(1);
    expect(find.text('sq-stub-cards'), findsOneWidget);
  });

  testWidgets('несуществующий месяц в сроке действия отклоняется', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(api));
    await tester.pump();

    await _typeInto(tester, numberField, '4242424242424242');
    await _typeInto(tester, expiryField, '1329');
    await _typeInto(tester, holderField, 'IVAN IVANOV');

    await tester.tap(find.text('Сохранить'));
    await tester.pumpAndSettle();

    expect(find.text('Срок действия в формате ММ/ГГ'), findsOneWidget);
    verifyNever(
      () => api.addPaymentMethod(
        pan: any(named: 'pan'),
        expiry: any(named: 'expiry'),
        holderName: any(named: 'holderName'),
      ),
    );
  });

  testWidgets('слишком короткое имя держателя отклоняется', (tester) async {
    await tester.pumpWidget(_wrap(api));
    await tester.pump();

    await _typeInto(tester, numberField, '4242424242424242');
    await _typeInto(tester, expiryField, '1229');
    await _typeInto(tester, holderField, 'I');

    await tester.tap(find.text('Сохранить'));
    await tester.pumpAndSettle();

    expect(find.text('Укажите имя, как на карте'), findsOneWidget);
    verifyNever(
      () => api.addPaymentMethod(
        pan: any(named: 'pan'),
        expiry: any(named: 'expiry'),
        holderName: any(named: 'holderName'),
      ),
    );
  });

  testWidgets('сбой сети не оставляет кнопку в вечном спиннере', (
    tester,
  ) async {
    when(
      () => api.addPaymentMethod(
        pan: any(named: 'pan'),
        expiry: any(named: 'expiry'),
        holderName: any(named: 'holderName'),
      ),
    ).thenThrow(const ApiException(ApiErrorCode.network, 'нет сети', 0));

    await tester.pumpWidget(_wrap(api));
    await tester.pump();

    await _typeInto(tester, numberField, '4242424242424242');
    await _typeInto(tester, expiryField, '1229');
    await _typeInto(tester, holderField, 'IVAN IVANOV');

    await tester.tap(find.text('Сохранить'));
    await tester.pumpAndSettle();

    expect(find.text('Нет соединения с сервером'), findsOneWidget);
    expect(find.text('Сохранить'), findsOneWidget);
  });
}
