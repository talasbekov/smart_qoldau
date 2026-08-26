// Тесты SqApiSchedule: расписание и исключения эксперта (E7 задача 7).
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:shared/shared.dart';

SqApi _buildApi() => SqApi(
  baseUrl: 'https://api.test.local/v1',
  readTokens: () async => null,
  writeTokens: (_) async {},
  onLogout: () async {},
);

final _scheduleFixture = {
  'days': [
    {'weekday': 0, 'enabled': true, 'startMin': 480, 'endMin': 960},
    {'weekday': 1, 'enabled': true, 'startMin': 480, 'endMin': 960},
    {'weekday': 2, 'enabled': true, 'startMin': 480, 'endMin': 960},
    {'weekday': 3, 'enabled': true, 'startMin': 480, 'endMin': 960},
    {'weekday': 4, 'enabled': true, 'startMin': 480, 'endMin': 960},
    {'weekday': 5, 'enabled': false},
    {'weekday': 6, 'enabled': false},
  ],
};

final _expertMeFixture = {
  'id': 'exp-123',
  'displayName': 'Test Expert',
  'city': 'Алматы',
  'experience': 'THREE_TO_FIVE',
  'education': 'University',
  'priceTiyn': 500000,
  'languages': ['ru'],
  'formats': ['chat'],
  'topicSlugs': ['anxiety'],
  'verificationStatus': 'VERIFIED',
  'workStatus': 'ACCEPTING',
  'isBlocked': false,
  'acceptsUrgent': true,
  'photoStatus': 'NONE',
  'aboutStatus': 'NONE',
};

final _exceptionFixture = {'date': '2026-08-25', 'isDayOff': true};

void main() {
  late SqApi api;
  late DioAdapter dioAdapter;

  setUp(() {
    api = _buildApi();
    dioAdapter = DioAdapter(dio: api.dio);
  });

  group('ScheduleDay and ScheduleException round-trip', () {
    test('ScheduleDay.fromJson/toJson переносят все поля', () {
      final json = {
        'weekday': 2,
        'enabled': true,
        'startMin': 540,
        'endMin': 900,
        'breakStart': 600,
        'breakEnd': 660,
      };

      final day = ScheduleDay.fromJson(json);
      expect(day.weekday, 2);
      expect(day.enabled, true);
      expect(day.startMin, 540);
      expect(day.endMin, 900);
      expect(day.breakStart, 600);
      expect(day.breakEnd, 660);

      final reconstructed = day.toJson();
      expect(reconstructed, json);
    });

    test('ScheduleException.fromJson/toJson переносят все поля', () {
      final json = {
        'date': '2026-08-25',
        'isDayOff': false,
        'startMin': 480,
        'endMin': 720,
      };

      final exception = ScheduleException.fromJson(json);
      expect(exception.date, '2026-08-25');
      expect(exception.isDayOff, false);
      expect(exception.startMin, 480);
      expect(exception.endMin, 720);

      final reconstructed = exception.toJson();
      expect(reconstructed, json);
    });
  });

  group('SqApiSchedule.schedule', () {
    test('возвращает список из 7 дней расписания', () async {
      dioAdapter.onGet(
        '/experts/me/schedule',
        (server) => server.reply(200, _scheduleFixture),
      );

      final result = await api.schedule();

      expect(result, hasLength(7));
      expect(result[0].weekday, 0);
      expect(result[0].enabled, true);
      expect(result[5].weekday, 5);
      expect(result[5].enabled, false);
    });
  });

  group('SqApiSchedule.updateSchedule', () {
    test('отправляет 7 дней и возвращает обновлённое расписание', () async {
      final days = List.generate(
        7,
        (i) => ScheduleDay(
          weekday: i,
          enabled: i < 5,
          startMin: i < 5 ? 480 : null,
          endMin: i < 5 ? 960 : null,
        ),
      );

      dioAdapter.onPut(
        '/experts/me/schedule',
        (server) => server.reply(200, _scheduleFixture),
        data: {'days': days.map((d) => d.toJson()).toList()},
      );

      final result = await api.updateSchedule(days);

      expect(result, hasLength(7));
      expect(result[0].enabled, true);
    });

    test(
      'массив длины != 7 бросает ArgumentError до сетевого запроса',
      () async {
        final sixDays = List.generate(
          6,
          (i) => ScheduleDay(
            weekday: i,
            enabled: true,
            startMin: 480,
            endMin: 960,
          ),
        );

        expect(
          () => api.updateSchedule(sixDays),
          throwsA(isA<ArgumentError>()),
        );

        final eightDays = List.generate(
          8,
          (i) => ScheduleDay(
            weekday: i,
            enabled: true,
            startMin: 480,
            endMin: 960,
          ),
        );

        expect(
          () => api.updateSchedule(eightDays),
          throwsA(isA<ArgumentError>()),
        );
      },
    );
  });

  group('SqApiSchedule.setAcceptsUrgent', () {
    test('отправляет PATCH и возвращает обновлённый профиль', () async {
      dioAdapter.onPatch(
        '/experts/me/availability',
        (server) => server.reply(200, _expertMeFixture),
        data: {'acceptsUrgent': false},
      );

      final result = await api.setAcceptsUrgent(false);

      expect(result.id, 'exp-123');
    });
  });

  group('SqApiSchedule.exceptions', () {
    test('возвращает список исключений за период', () async {
      dioAdapter.onGet(
        '/experts/me/schedule/exceptions',
        (server) => server.reply(200, [_exceptionFixture]),
      );

      final result = await api.exceptions(from: '2026-08-01', to: '2026-08-31');

      expect(result, hasLength(1));
      expect(result[0].date, '2026-08-25');
      expect(result[0].isDayOff, true);
    });
  });

  group('SqApiSchedule.upsertException', () {
    test('отправляет PUT с датой и возвращает исключение', () async {
      dioAdapter.onPut(
        '/experts/me/schedule/exceptions/2026-08-25',
        (server) => server.reply(200, _exceptionFixture),
        data: {'isDayOff': true},
      );

      final result = await api.upsertException('2026-08-25', isDayOff: true);

      expect(result.date, '2026-08-25');
      expect(result.isDayOff, true);
    });

    test('isDayOff: false без startMin/endMin бросает ArgumentError до сетевого запроса', () async {
      expect(
        () => api.upsertException('2026-08-26', isDayOff: false),
        throwsA(isA<ArgumentError>()),
      );
    });

    test(
      'isDayOff: false без endMin бросает ArgumentError до сетевого запроса',
      () async {
        expect(
          () =>
              api.upsertException('2026-08-26', isDayOff: false, startMin: 480),
          throwsA(isA<ArgumentError>()),
        );
      },
    );

    test(
      'isDayOff: false с обоими startMin/endMin успешно отправляет',
      () async {
        dioAdapter.onPut(
          '/experts/me/schedule/exceptions/2026-08-26',
          (server) => server.reply(200, {
            'date': '2026-08-26',
            'isDayOff': false,
            'startMin': 480,
            'endMin': 720,
          }),
          data: {'isDayOff': false, 'startMin': 480, 'endMin': 720},
        );

        final result = await api.upsertException(
          '2026-08-26',
          isDayOff: false,
          startMin: 480,
          endMin: 720,
        );

        expect(result.isDayOff, false);
        expect(result.startMin, 480);
        expect(result.endMin, 720);
      },
    );

    test('isDayOff: true без startMin/endMin успешно отправляет', () async {
      dioAdapter.onPut(
        '/experts/me/schedule/exceptions/2026-08-27',
        (server) => server.reply(200, {'date': '2026-08-27', 'isDayOff': true}),
        data: {'isDayOff': true},
      );

      final result = await api.upsertException('2026-08-27', isDayOff: true);

      expect(result.isDayOff, true);
    });
  });

  group('SqApiSchedule.deleteException', () {
    test('отправляет DELETE и не бросает ошибку при 204', () async {
      dioAdapter.onDelete(
        '/experts/me/schedule/exceptions/2026-08-25',
        (server) => server.reply(204, null),
      );

      // Должно не бросать ошибку
      await api.deleteException('2026-08-25');
    });
  });
}
