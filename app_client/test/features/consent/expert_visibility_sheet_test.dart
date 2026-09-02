// Р-27: экран согласия в приложении клиента.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:app_client/features/consent/ui/expert_visibility_sheet.dart';

Widget _host({
  required Future<void> Function(String) onAccept,
  required void Function(bool) onResult,
}) {
  return MaterialApp(
    home: Builder(
      builder: (context) => Scaffold(
        body: Center(
          child: FilledButton(
            onPressed: () async {
              final accepted = await showExpertVisibilityConsent(
                context: context,
                onAccept: onAccept,
              );
              onResult(accepted);
            },
            child: const Text('открыть'),
          ),
        ),
      ),
    ),
  );
}

void main() {
  testWidgets('объясняет, что увидит психолог и чего не увидит', (tester) async {
    await tester.pumpWidget(_host(onAccept: (_) async {}, onResult: (_) {}));
    await tester.tap(find.text('открыть'));
    await tester.pumpAndSettle();

    expect(find.textContaining('увидит ваше имя'), findsOneWidget);
    expect(
      find.textContaining('телефон психологу не показывается'),
      findsOneWidget,
    );
  });

  testWidgets('пустое имя не отправляется', (tester) async {
    var called = false;
    await tester.pumpWidget(
      _host(onAccept: (_) async => called = true, onResult: (_) {}),
    );
    await tester.tap(find.text('открыть'));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('sq-consent-submit')));
    await tester.pumpAndSettle();

    expect(called, isFalse);
    expect(find.textContaining('Напишите, как к вам обращаться'), findsOneWidget);
  });

  testWidgets('согласие передаёт имя и закрывает шторку с true', (tester) async {
    String? received;
    bool? result;
    await tester.pumpWidget(
      _host(
        onAccept: (name) async => received = name,
        onResult: (value) => result = value,
      ),
    );
    await tester.tap(find.text('открыть'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('sq-consent-name')), 'Айгерим');
    await tester.tap(find.byKey(const Key('sq-consent-submit')));
    await tester.pumpAndSettle();

    expect(received, 'Айгерим');
    expect(result, isTrue);
  });

  testWidgets('ошибка сохранения показывается, шторка остаётся', (tester) async {
    await tester.pumpWidget(
      _host(
        onAccept: (_) async => throw Exception('нет связи'),
        onResult: (_) {},
      ),
    );
    await tester.tap(find.text('открыть'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('sq-consent-name')), 'Айгерим');
    await tester.tap(find.byKey(const Key('sq-consent-submit')));
    await tester.pumpAndSettle();

    expect(find.textContaining('Не удалось сохранить'), findsOneWidget);
    expect(find.byKey(const Key('sq-consent-name')), findsOneWidget);
  });
}
