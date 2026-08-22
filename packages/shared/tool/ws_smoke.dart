// ignore_for_file: avoid_print — это диагностический CLI-скрипт, печать в
// консоль и есть его единственная задача, логирование тут неуместно.
//
// Ручная проверка транспорта (задача 8 эпика E6, шаг 3 брифа) — НЕ тест, не
// гоняется в CI/`flutter test`. Поднимает реальное соединение к живому
// бэкенду и печатает итог: держится ли оно. Токен — аргумент командной
// строки, не логируется целиком (PII/секрет — см. Global Constraints
// задачи), в вывод попадает только факт подключения.
//
// Бэкенд поднимается так:
//   docker compose -f infra/docker-compose.dev.yml up -d
//   cd backend && npm run start:dev
// Гостевой токен: POST /v1/auth/guest {"deviceId": "..."} -> accessToken.
//
// Запуск:
//   dart run packages/shared/tool/ws_smoke.dart --token=<access>
//   dart run packages/shared/tool/ws_smoke.dart --token=garbage
import 'dart:io';

// Импорт напрямую из `events/sq_socket.dart`, а НЕ из барели
// `package:shared/shared.dart`: барель тянет дизайн-систему
// (`design/tokens.dart` -> `package:flutter/material.dart` -> `dart:ui`),
// а этот скрипт гоняется голым `dart run` (без движка Flutter, `dart:ui`
// недоступна) — компиляция барели на чистом Dart VM падает.
import 'package:shared/events/sq_socket.dart';

Future<void> main(List<String> args) async {
  String? token;
  var wsBase = 'http://localhost:3000';
  for (final arg in args) {
    if (arg.startsWith('--token=')) {
      token = arg.substring('--token='.length);
    } else if (arg.startsWith('--ws-base=')) {
      wsBase = arg.substring('--ws-base='.length);
    }
  }
  if (token == null) {
    stderr.writeln(
      'Использование: dart run ws_smoke.dart --token=<access> '
      '[--ws-base=http://localhost:3000]',
    );
    exitCode = 64;
    return;
  }

  final socket = SocketIoSqSocket(wsBase: wsBase);
  final sub = socket.events.listen((raw) => print('событие: ${raw.$1}'));

  await socket.connect(token);
  await Future<void>.delayed(const Duration(seconds: 2));
  print(
    socket.isConnected
        ? 'connect(): CONNECTED к $wsBase/ws — токен принят'
        : 'connect(): DISCONNECTED — сервер разорвал соединение (токен отклонён?)',
  );

  // Round 1 ревью задачи 8, п.1: явный disconnect() — путь, которым
  // изначальный фикс (zone только вокруг connect()) НЕ был защищён.
  // Печатаем результат явно: если процесс дожил досюда без необработанного
  // исключения — фикс держится и на этом пути.
  await socket.disconnect();
  print('disconnect(): вызван, необработанных исключений нет');

  // Переподключение (reconnectWith после рефреша токена — тот же вызов на
  // уровне SqSocket) — держится ли соединение снова.
  await socket.connect(token);
  await Future<void>.delayed(const Duration(seconds: 2));
  print(
    socket.isConnected
        ? 'connect() повторно: CONNECTED — переподключение работает'
        : 'connect() повторно: DISCONNECTED',
  );

  await sub.cancel();
  await socket.disconnect();
  print('итоговый disconnect(): вызван, необработанных исключений нет');
}
