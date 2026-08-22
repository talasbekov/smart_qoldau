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
//   # сценарий «рефреш при подключённом сокете» (Round 2 ревью, п.1) —
//   # нужен ВТОРОЙ валидный токен той же или другой сессии (например,
//   # второй вызов POST /v1/auth/guest, или accessToken, полученный через
//   # POST /v1/auth/refresh реальным refreshToken):
//   dart run packages/shared/tool/ws_smoke.dart --token=<access1> --token2=<access2>
import 'dart:io';

// Импорт напрямую из `events/sq_socket.dart`, а НЕ из барели
// `package:shared/shared.dart`: барель тянет дизайн-систему
// (`design/tokens.dart` -> `package:flutter/material.dart` -> `dart:ui`),
// а этот скрипт гоняется голым `dart run` (без движка Flutter, `dart:ui`
// недоступна) — компиляция барели на чистом Dart VM падает.
import 'package:shared/events/sq_socket.dart';

Future<void> main(List<String> args) async {
  String? token;
  String? token2;
  var wsBase = 'http://localhost:3000';
  for (final arg in args) {
    if (arg.startsWith('--token=')) {
      token = arg.substring('--token='.length);
    } else if (arg.startsWith('--token2=')) {
      token2 = arg.substring('--token2='.length);
    } else if (arg.startsWith('--ws-base=')) {
      wsBase = arg.substring('--ws-base='.length);
    }
  }
  if (token == null) {
    stderr.writeln(
      'Использование: dart run ws_smoke.dart --token=<access> '
      '[--token2=<access2>] [--ws-base=http://localhost:3000]',
    );
    exitCode = 64;
    return;
  }

  final socket = SocketIoSqSocket(wsBase: wsBase);
  final sub = socket.events.listen((raw) => print('событие: ${raw.$1}'));
  final states = <SqConnectionState>[];
  final stateSub = socket.connectionState.listen((s) {
    states.add(s);
    print('состояние: $s');
  });

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

  if (token2 != null) {
    // Round 2 ревью, п.1 (Critical): молчаливый рефреш AuthInterceptor
    // пишет новый токен, ПОКА сокет уже подключён старым — connect()
    // вызывается ПОВТОРНО на уже живом сокете, БЕЗ предварительного
    // явного disconnect(). До фикса это порождало ложный `disconnected`
    // (преамбула connect() рвёт предыдущий живой сокет как побочный
    // эффект) — connectSqEvents принимал его за отказ аутентификации и
    // разлогинивал полностью исправную сессию.
    states.clear();
    await socket.connect(token2);
    await Future<void>.delayed(const Duration(seconds: 2));
    print(
      socket.isConnected
          ? 'connect(token2) без явного disconnect(): CONNECTED'
          : 'connect(token2) без явного disconnect(): DISCONNECTED',
    );
    print(
      states.contains(SqConnectionState.disconnected)
          ? 'РЕГРЕССИЯ: connectionState показал disconnected при обычном '
              'переподключении — выглядело бы как отказ аутентификации'
          : 'OK: connectionState НЕ показал disconnected при '
              'переподключении новым токеном — рефреш при подключённом '
              'сокете не выглядит как отказ аутентификации',
    );
  }

  await sub.cancel();
  await stateSub.cancel();
  await socket.disconnect();
  print('итоговый disconnect(): вызван, необработанных исключений нет');
}
