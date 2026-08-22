// Контрактный тест: каждый (метод, путь) из SqEndpoints.contractEndpoints
// обязан существовать в выгрузке docs/openapi.json (см. `npm run
// openapi:dump` в backend). Рабочий каталог теста — корень пакета
// (packages/shared), поэтому до docs/openapi.json нужно подняться на два
// уровня.
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

void main() {
  test('every SqEndpoints entry (except the task-9 exclusion) is in docs/openapi.json', () {
    final file = File('../../docs/openapi.json');
    expect(
      file.existsSync(),
      isTrue,
      reason: 'Не найден ${file.path} — сначала выполни `npm run openapi:dump` в backend',
    );

    final spec = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
    final paths = spec['paths'] as Map<String, dynamic>;

    final missing = <String>[];
    for (final endpoint in SqEndpoints.contractEndpoints) {
      if (SqEndpoints.excludedFromContractTest.contains(endpoint)) {
        continue;
      }
      final (method, path) = endpoint;
      final fullPath = '/v1$path';
      final methodsForPath = paths[fullPath];
      final hasMethod = methodsForPath is Map &&
          methodsForPath.containsKey(method.toLowerCase());
      if (!hasMethod) {
        missing.add('$method $fullPath');
      }
    }

    expect(
      missing,
      isEmpty,
      reason:
          'В docs/openapi.json не найдены пути из SqEndpoints.contractEndpoints: '
          '${missing.join(', ')}',
    );
  });

  test('the task-9 exclusion is exactly the online-count endpoint', () {
    // Сторожевой тест: не даёт исключению незаметно "распухнуть" другими
    // путями — как только бэкенд задачи 9 добавит /matching/online-count в
    // openapi.json, исключение нужно снять (см. SqEndpoints).
    expect(SqEndpoints.excludedFromContractTest, {
      ('GET', '/matching/online-count'),
    });
  });
}
