import 'package:flutter/material.dart';

import 'breakpoints.dart';
import 'tokens.dart';

/// Показывает содержимое так, как принято на текущем размере экрана:
/// шторкой снизу на телефоне и диалогом по центру на широком.
///
/// Шторка снизу — мобильная идиома. На мониторе она растягивается во всю
/// ширину и заставляет вести глаз от верхнего края к нижнему; диалог по
/// центру с ограниченной шириной читается там естественно. Логика
/// содержимого при этом одна и та же — различается только обрамление.
Future<T?> showSqSheetOrDialog<T>({
  required BuildContext context,
  required WidgetBuilder builder,
  bool isScrollControlled = true,
  double maxDialogWidth = 520,
  Color? backgroundColor,
  ShapeBorder? shape,
}) {
  if (!SqLayoutScope.of(context).isWide) {
    // Оформление шторки прокидывается как есть: на телефоне вид не
    // меняется вовсе, иначе перевод на этот помощник тихо поменял бы
    // скругления и фон на шести экранах сразу.
    return showModalBottomSheet<T>(
      context: context,
      isScrollControlled: isScrollControlled,
      backgroundColor: backgroundColor,
      shape: shape,
      builder: builder,
    );
  }

  return showDialog<T>(
    context: context,
    builder: (dialogContext) => Dialog(
      backgroundColor: backgroundColor ?? SqColors.surface,
      // У диалога скругление со всех сторон, а не только сверху, как у
      // шторки: форма шторки на диалоге выглядит обрезанной.
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(SqRadius.l),
      ),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: maxDialogWidth,
          // Диалог не должен вырастать выше окна: содержимое шторок
          // бывает длинным (фильтры каталога, список карт).
          maxHeight: MediaQuery.sizeOf(dialogContext).height * 0.8,
        ),
        child: builder(dialogContext),
      ),
    ),
  );
}
