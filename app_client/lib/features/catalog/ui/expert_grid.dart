/// Сетка карточек каталога.
///
/// Прототип `SmartQoldau Web - Каталог` раскладывает специалистов как
/// `repeat(auto-fit, minmax(270px, 1fr))`: сколько колонок влезло по
/// 270 px, столько и рисуем. На телефоне это ровно одна колонка, то есть
/// прежний список, — поэтому отдельной мобильной ветки не нужно.
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

/// Минимальная ширина карточки каталога из прототипа. Уже — и в карточку
/// перестают помещаться имя, специализации и цена в одну строку. У
/// материалов прототип задаёт 260 px, поэтому значение параметризовано.
const double _defaultMinCardWidth = 270;

class ExpertGrid extends StatelessWidget {
  const ExpertGrid({
    super.key,
    required this.itemCount,
    required this.itemBuilder,
    this.footer,
    this.padding = const EdgeInsets.all(SqSpacing.l),
    this.minItemWidth = _defaultMinCardWidth,
    this.controller,
  });

  final int itemCount;
  final IndexedWidgetBuilder itemBuilder;
  final Widget? footer;
  final EdgeInsets padding;
  final double minItemWidth;
  final ScrollController? controller;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final available = constraints.maxWidth - padding.horizontal;
        // auto-fit: столько колонок, сколько влезает целиком.
        final columns = (available / minItemWidth).floor().clamp(1, 4);

        return ListView(
          controller: controller,
          padding: padding,
          children: [
            if (columns == 1)
              for (var i = 0; i < itemCount; i++) itemBuilder(context, i)
            else
              Wrap(
                spacing: SqSpacing.m,
                runSpacing: SqSpacing.m,
                children: [
                  for (var i = 0; i < itemCount; i++)
                    SizedBox(
                      width:
                          (available - SqSpacing.m * (columns - 1)) / columns,
                      child: itemBuilder(context, i),
                    ),
                ],
              ),
            ?footer,
          ],
        );
      },
    );
  }
}
