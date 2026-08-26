import 'package:flutter/material.dart';

import 'breakpoints.dart';
import 'tokens.dart';

/// Основная колонка и боковая. Пропорция 1.4 : 1 взята из прототипов
/// (`Web - Профиль психолога`, `Expert Web - Главная`): в боковой живёт
/// то, ради чего человек пришёл — цена и кнопка записи, — и делить экран
/// поровну значит отдать половину под панель действия.
///
/// На узком экране колонки становятся одной: боковая уходит ПОД
/// основную, а не наоборот, потому что на телефоне сначала читают, кто
/// этот специалист, и только потом записываются.
class SqSplitLayout extends StatelessWidget {
  const SqSplitLayout({
    super.key,
    required this.main,
    required this.aside,
    this.padding = const EdgeInsets.all(SqSpacing.l),
    this.asideWidth,
    this.asideFirst = false,
  });

  final Widget main;
  final Widget aside;
  final EdgeInsets padding;

  /// Фиксированная ширина боковой колонки. Прототипы задают её то долей
  /// (1.4 : 1 у профиля психолога), то числом (340 px у рейтинга,
  /// 320 px у дохода) — поддерживаем оба способа, а не подгоняем один
  /// под другой.
  final double? asideWidth;

  /// Боковая колонка слева. У рейтинга сводка стоит перед списком
  /// отзывов, а не после него.
  final bool asideFirst;

  List<Widget> _aside() => [
    if (asideWidth == null)
      Expanded(flex: 10, child: SingleChildScrollView(child: aside))
    else
      SizedBox(
        width: asideWidth,
        child: SingleChildScrollView(child: aside),
      ),
    if (asideFirst) const SizedBox(width: SqSpacing.l),
  ];

  @override
  Widget build(BuildContext context) {
    final wide = SqLayoutScope.of(context).isWide;

    if (!wide) {
      // SingleChildScrollView, а не ListView: ListView строит детей
      // лениво, и боковая карточка (цена, кнопка записи) не существует в
      // дереве, пока до неё не долистают. Для тестов это «элемента нет», а
      // для доступности — содержимое, о котором скринридер не знает.
      return SingleChildScrollView(
        padding: padding,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            main,
            const SizedBox(height: SqSpacing.l),
            aside,
          ],
        ),
      );
    }

    // У каждой колонки своя прокрутка. Это не только про длинные списки
    // отзывов: боковая карточка с ценой и кнопкой записи остаётся на
    // виду, пока человек листает отзывы, — ровно как «липкая» панель в
    // прототипе.
    return Padding(
      padding: padding,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (asideFirst) ..._aside(),
          Expanded(flex: 14, child: SingleChildScrollView(child: main)),
          if (!asideFirst) ...[
            const SizedBox(width: SqSpacing.l),
            ..._aside(),
          ],
        ],
      ),
    );
  }
}
