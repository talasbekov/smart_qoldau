import 'package:flutter/widgets.dart';

/// Раскладка экрана. Выбирается ПО ШИРИНЕ окна, а не по платформе:
/// планшет, складной телефон и узкое окно на десктопе должны выглядеть
/// одинаково, а проверка вида «это веб — значит десктоп» даёт растянутый
/// телефон на планшете и сломанную вёрстку в половине окна.
enum SqLayout {
  /// < 720: одна колонка, нижняя навигация — то, что было до E14.
  phone,

  /// 720–1279: две колонки там, где это осмысленно.
  tablet,

  /// ≥ 1280: боковая навигация, рабочая область в несколько колонок.
  desktop;

  /// Широкая раскладка — планшет и десктоп. Отдельная проверка нужна
  /// часто: экранов, которым важно «шире телефона», больше, чем тех, кому
  /// важен именно десктоп.
  bool get isWide => this != SqLayout.phone;
}

/// Границы. Значения живут здесь и больше нигде: разъехавшиеся числа по
/// экранам — это когда меню уже боковое, а список ещё телефонный.
const double sqTabletMinWidth = 720;
const double sqDesktopMinWidth = 1280;

SqLayout sqLayoutFor(double width) {
  if (width >= sqDesktopMinWidth) return SqLayout.desktop;
  if (width >= sqTabletMinWidth) return SqLayout.tablet;
  return SqLayout.phone;
}

abstract final class SqLayoutScope {
  /// Раскладка для текущего контекста. Берёт ширину из `MediaQuery`,
  /// поэтому реагирует на изменение размера окна — в браузере его меняют
  /// мышью посреди работы.
  static SqLayout of(BuildContext context) =>
      sqLayoutFor(MediaQuery.sizeOf(context).width);
}
