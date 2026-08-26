// Тесты разбора диплинков (Step 1 брифа задачи 23): таблица поддерживаемых
// ссылок, отказ на чужом хосте и мусоре, отложенный переход до появления
// сессии.
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:app_client/core/deep_links.dart';
import 'package:app_client/core/locale_controller.dart';
import 'package:app_client/features/auth/state/auth_controller.dart';

void main() {
  group('маршрут ссылки внутри роутера', () {
    test('путь ссылки переводится в маршрут приложения', () {
      // Flutter отдаёт роутеру ПУТЬ входящей ссылки (`/e/expert-1`), а не
      // весь URI: перевод должен работать и от одного пути.
      expect(DeepLinks.resolvePath('/e/expert-1'), '/catalog/expert/expert-1');
      expect(DeepLinks.resolvePath('/sos'), '/emergency');
      expect(DeepLinks.resolvePath('/catalog'), isNull);
    });
  });

  group('DeepLinks.resolve', () {
    test('поддерживаемые ссылки дают ожидаемые маршруты', () {
      expect(
        DeepLinks.resolve(Uri.parse('https://smartqoldau.kz/e/expert-1')),
        '/catalog/expert/expert-1',
      );
      expect(
        DeepLinks.resolve(Uri.parse('https://smartqoldau.kz/t/anxiety-stress')),
        '/topic?slug=anxiety-stress',
      );
      expect(
        DeepLinks.resolve(Uri.parse('https://smartqoldau.kz/sos')),
        '/emergency',
      );
      expect(
        DeepLinks.resolve(Uri.parse('https://smartqoldau.kz/c/c1')),
        '/session/c1',
      );
    });

    test('чужой хост и чужая схема не разбираются', () {
      // Иначе любая ссылка с чужого сайта уводила бы человека внутрь
      // приложения по нашим маршрутам.
      expect(
        DeepLinks.resolve(Uri.parse('https://example.com/e/expert-1')),
        isNull,
      );
      expect(DeepLinks.resolve(Uri.parse('ftp://smartqoldau.kz/sos')), isNull);
    });

    test('неизвестный путь, мусор и пустой идентификатор дают null', () {
      expect(
        DeepLinks.resolve(Uri.parse('https://smartqoldau.kz/unknown')),
        isNull,
      );
      expect(DeepLinks.resolve(Uri.parse('https://smartqoldau.kz/e/')), isNull);
      expect(DeepLinks.resolve(Uri.parse('https://smartqoldau.kz/')), isNull);
      expect(DeepLinks.resolve(Uri.parse('не-ссылка')), isNull);
    });

    test('идентификатор с посторонними символами отбрасывается', () {
      // Ссылка — внешний ввод: подставлять её кусок в путь роутера без
      // проверки нельзя.
      expect(
        DeepLinks.resolve(Uri.parse('https://smartqoldau.kz/e/../../admin')),
        isNull,
      );
      expect(
        DeepLinks.resolve(
          Uri.parse('https://smartqoldau.kz/t/тема%20с%20пробелом'),
        ),
        isNull,
      );
    });
  });

  group('отложенный переход', () {
    late List<String> navigated;

    Future<ProviderContainer> container() async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final container = ProviderContainer(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          systemLocaleProvider.overrideWithValue(const Locale('ru')),
          deepLinkNavigatorProvider.overrideWithValue(navigated.add),
        ],
      );
      addTearDown(container.dispose);
      return container;
    }

    setUp(() => navigated = []);

    test(
      'ссылка, открытая до восстановления сессии, применяется ПОСЛЕ неё',
      () async {
        // При `AuthUnknown` редирект-гард уводит на `/splash`, и немедленный
        // переход по ссылке потерялся бы.
        final c = await container();
        final handler = c.read(deepLinkHandlerProvider);

        handler.handle(Uri.parse('https://smartqoldau.kz/c/c1'));
        expect(navigated, isEmpty, reason: 'сессии ещё нет — переход отложен');

        c.read(authControllerProvider.notifier).state = const AsyncData(
          AuthGuest(AuthUser(id: 'u1', phone: null, isGuest: true)),
        );
        await Future<void>.delayed(Duration.zero);

        expect(navigated, ['/session/c1']);
      },
    );

    test('при уже готовой сессии переход происходит сразу', () async {
      final c = await container();
      c.read(authControllerProvider.notifier).state = const AsyncData(
        AuthGuest(AuthUser(id: 'u1', phone: null, isGuest: true)),
      );
      final handler = c.read(deepLinkHandlerProvider);

      handler.handle(Uri.parse('https://smartqoldau.kz/sos'));

      expect(navigated, ['/emergency']);
    });

    test('нераспознанная ссылка не откладывается и никуда не ведёт', () async {
      final c = await container();
      final handler = c.read(deepLinkHandlerProvider);

      handler.handle(Uri.parse('https://example.com/sos'));
      c.read(authControllerProvider.notifier).state = const AsyncData(
        AuthGuest(AuthUser(id: 'u1', phone: null, isGuest: true)),
      );
      await Future<void>.delayed(Duration.zero);

      expect(navigated, isEmpty);
    });

    test('отложенная ссылка применяется ровно один раз', () async {
      final c = await container();
      final handler = c.read(deepLinkHandlerProvider);
      handler.handle(Uri.parse('https://smartqoldau.kz/sos'));

      c.read(authControllerProvider.notifier).state = const AsyncData(
        AuthGuest(AuthUser(id: 'u1', phone: null, isGuest: true)),
      );
      await Future<void>.delayed(Duration.zero);
      c.read(authControllerProvider.notifier).state = const AsyncData(
        AuthRegistered(AuthUser(id: 'u1', phone: '+7', isGuest: false)),
      );
      await Future<void>.delayed(Duration.zero);

      expect(navigated, ['/emergency']);
    });
  });
}
