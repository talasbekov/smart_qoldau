// Прямой round-trip тесты ScheduleDay и ScheduleException.
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

void main() {
  group('ScheduleDay serialization', () {
    test('fromJson разбирает полный день расписания со всеми полями', () {
      final json = {
        'weekday': 0,
        'enabled': true,
        'startMin': 480,
        'endMin': 960,
        'breakStart': 600,
        'breakEnd': 660,
      };

      final day = ScheduleDay.fromJson(json);

      expect(day.weekday, 0);
      expect(day.enabled, true);
      expect(day.startMin, 480);
      expect(day.endMin, 960);
      expect(day.breakStart, 600);
      expect(day.breakEnd, 660);
    });

    test('fromJson разбирает отключённый день без времени', () {
      final json = {'weekday': 1, 'enabled': false};

      final day = ScheduleDay.fromJson(json);

      expect(day.weekday, 1);
      expect(day.enabled, false);
      expect(day.startMin, isNull);
      expect(day.endMin, isNull);
      expect(day.breakStart, isNull);
      expect(day.breakEnd, isNull);
    });

    test('toJson преобразует ScheduleDay в JSON', () {
      final day = ScheduleDay(
        weekday: 2,
        enabled: true,
        startMin: 540,
        endMin: 900,
        breakStart: 630,
        breakEnd: 690,
      );

      final json = day.toJson();

      expect(json['weekday'], 2);
      expect(json['enabled'], true);
      expect(json['startMin'], 540);
      expect(json['endMin'], 900);
      expect(json['breakStart'], 630);
      expect(json['breakEnd'], 690);
    });

    test('round-trip: fromJson -> toJson воспроизводит исходный JSON', () {
      final original = {
        'weekday': 3,
        'enabled': true,
        'startMin': 600,
        'endMin': 1080,
        'breakStart': 720,
        'breakEnd': 780,
      };

      final day = ScheduleDay.fromJson(original);
      final reconstructed = day.toJson();

      expect(reconstructed, original);
    });
  });

  group('ScheduleException serialization', () {
    test('fromJson разбирает исключение выходного дня', () {
      final json = {'date': '2026-08-25', 'isDayOff': true};

      final exception = ScheduleException.fromJson(json);

      expect(exception.date, '2026-08-25');
      expect(exception.isDayOff, true);
      expect(exception.startMin, isNull);
      expect(exception.endMin, isNull);
    });

    test('fromJson разбирает исключение со временем работы', () {
      final json = {
        'date': '2026-08-26',
        'isDayOff': false,
        'startMin': 480,
        'endMin': 720,
      };

      final exception = ScheduleException.fromJson(json);

      expect(exception.date, '2026-08-26');
      expect(exception.isDayOff, false);
      expect(exception.startMin, 480);
      expect(exception.endMin, 720);
    });

    test('toJson преобразует ScheduleException в JSON', () {
      final exception = ScheduleException(date: '2026-08-27', isDayOff: true);

      final json = exception.toJson();

      expect(json['date'], '2026-08-27');
      expect(json['isDayOff'], true);
      expect(json.containsKey('startMin'), false);
      expect(json.containsKey('endMin'), false);
    });

    test('toJson для исключения со временем включает startMin/endMin', () {
      final exception = ScheduleException(
        date: '2026-08-28',
        isDayOff: false,
        startMin: 900,
        endMin: 1080,
      );

      final json = exception.toJson();

      expect(json['date'], '2026-08-28');
      expect(json['isDayOff'], false);
      expect(json['startMin'], 900);
      expect(json['endMin'], 1080);
    });

    test('round-trip: fromJson -> toJson воспроизводит исходный JSON для выходного дня', () {
      final original = {'date': '2026-08-29', 'isDayOff': true};

      final exception = ScheduleException.fromJson(original);
      final reconstructed = exception.toJson();

      expect(reconstructed, original);
    });

    test('round-trip: fromJson -> toJson воспроизводит исходный JSON для рабочего дня', () {
      final original = {
        'date': '2026-08-30',
        'isDayOff': false,
        'startMin': 360,
        'endMin': 840,
      };

      final exception = ScheduleException.fromJson(original);
      final reconstructed = exception.toJson();

      expect(reconstructed, original);
    });
  });
}
