import 'package:flutter/material.dart';

/// Ограничивает ширину содержимого на широком экране.
///
/// Одноколоночные экраны — поиск специалиста, формы, онбординг — на
/// мониторе растягиваются на всю ширину, и строка в 1400 пикселей
/// перестаёт читаться: глаз теряет начало следующей строки. Прототипы
/// веба держат такие блоки в пределах 560–900 px по центру.
///
/// На телефоне виджет не делает ничего: там ширина и так ограничена
/// устройством.
class SqReadableWidth extends StatelessWidget {
  const SqReadableWidth({super.key, required this.child, this.maxWidth = 720});

  final Widget child;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: child,
      ),
    );
  }
}
