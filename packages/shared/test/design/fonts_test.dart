// Шрифт Inter должен быть забандлен в пакет, а не подгружаться сетью
// (задача 21 эпика E6): приложение для людей в кризисе не может зависеть
// от доступности fonts.google.com, а тесты — печатать сетевые ошибки.
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';
import 'package:yaml/yaml.dart';

void main() {
  test('тема строится на забандленном семействе Inter', () {
    // `packages/shared/Inter` — как Flutter именует семейство, объявленное
    // внутри пакета: без префикса шрифт искался бы в приложении.
    expect(sqTheme().textTheme.bodyMedium!.fontFamily, 'packages/shared/Inter');
    expect(SqTypography.h1.fontFamily, 'packages/shared/Inter');
  });

  test('в pubspec объявлены четыре начертания Inter с весами 400–700', () {
    final pubspec = loadYaml(File('pubspec.yaml').readAsStringSync()) as YamlMap;
    final fonts = (pubspec['flutter'] as YamlMap)['fonts'] as YamlList;
    final inter = fonts.firstWhere((family) => family['family'] == 'Inter');
    final assets = inter['fonts'] as YamlList;

    expect(assets.length, 4);
    expect(
      assets.map((asset) => asset['weight']).toList(),
      [400, 500, 600, 700],
    );
    for (final asset in assets) {
      expect(
        File(asset['asset'] as String).existsSync(),
        isTrue,
        reason: 'файл шрифта ${asset['asset']} отсутствует в пакете',
      );
    }
  });

  test('google_fonts не импортируется и не вызывается в пакете', () {
    // Ищем именно импорт и обращение к API в КОДЕ: упоминание в
    // комментарии («раньше брали через google_fonts») — история, а не
    // нарушение, поэтому строки комментариев отбрасываем.
    final usage = RegExp(r"package:google_fonts|GoogleFonts\.");
    final offenders = <String>[];
    for (final entity in Directory('lib').listSync(recursive: true)) {
      if (entity is! File || !entity.path.endsWith('.dart')) continue;
      final code = entity
          .readAsLinesSync()
          .where((line) => !line.trimLeft().startsWith('//'))
          .join('\n');
      if (usage.hasMatch(code)) offenders.add(entity.path);
    }
    expect(offenders, isEmpty);

    // И самой зависимости в pubspec быть не должно.
    expect(
      File('pubspec.yaml').readAsStringSync().contains('google_fonts:'),
      isFalse,
    );
  });
}
