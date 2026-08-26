/// Сетка карточек каталога.
///
/// Прототип `SmartQoldau Web - Каталог` раскладывает специалистов как
/// `repeat(auto-fit, minmax(270px, 1fr))`: сколько колонок влезло по
/// 270 px, столько и рисуем. На телефоне это ровно одна колонка, то есть
/// прежний список, — поэтому отдельной мобильной ветки не нужно.
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

/// Минимальная ширина карточки из прототипа. Уже — и в карточку перестают
/// помещаться имя, специализации и цена в одну строку.
const double _minCardWidth = 270;

class ExpertGrid extends StatelessWidget {
  const ExpertGrid({
    super.key,
    required this.itemCount,
    required this.itemBuilder,
    this.footer,
    this.padding = const EdgeInsets.all(SqSpacing.l),
  });

  final int itemCount;
  final IndexedWidgetBuilder itemBuilder;
  final Widget? footer;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final available = constraints.maxWidth - padding.horizontal;
        // auto-fit: столько колонок, сколько влезает целиком.
        final columns = (available / _minCardWidth).floor().clamp(1, 4);

        return ListView(
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
