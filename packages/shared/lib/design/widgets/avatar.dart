import 'package:flutter/material.dart';

import '../tokens.dart';

/// Палитра фонов для [SqAvatar]. Конкретный цвет выбирается по хешу имени,
/// так что один и тот же цвет всегда закреплён за одним и тем же именем.
const List<Color> _avatarPalette = [
  SqColors.primary,
  SqColors.accent,
  SqColors.primaryDark,
  SqColors.textSecondary,
  SqColors.textTertiary,
];

/// Круглый аватар с инициалами дизайн-системы SmartQoldau.
///
/// Фон детерминирован именем: для одного и того же [name] цвет всегда
/// один и тот же (выбирается по хешу строки из фиксированной палитры).
class SqAvatar extends StatelessWidget {
  const SqAvatar({super.key, required this.name, this.size = 44});

  final String name;
  final double size;

  String get _initials {
    final words = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((word) => word.isNotEmpty)
        .toList();
    if (words.isEmpty) return '';

    final first = words.first.substring(0, 1).toUpperCase();
    if (words.length == 1) return first;

    final second = words[1].substring(0, 1).toUpperCase();
    return '$first$second';
  }

  Color get _backgroundColor {
    final index = name.hashCode.abs() % _avatarPalette.length;
    return _avatarPalette[index];
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: _backgroundColor,
        shape: BoxShape.circle,
      ),
      child: Text(
        _initials,
        style: SqTypography.title.copyWith(
          color: Colors.white,
          fontSize: size / 2.2,
        ),
      ),
    );
  }
}
