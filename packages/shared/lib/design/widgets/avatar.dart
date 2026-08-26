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

/// Круглый аватар дизайн-системы SmartQoldau: фотография, если она есть и
/// загрузилась, иначе инициалы.
///
/// Фон детерминирован именем: для одного и того же [name] цвет всегда
/// один и тот же (выбирается по хешу строки из фиксированной палитры).
///
/// Фолбэк на инициалы обязателен и покрыт тестом: сеть в мобильном
/// приложении отваливается регулярно, и пустой круг вместо специалиста —
/// плохой экран, а не редкий случай.
///
/// Кеш — тот, что даёт Flutter для [NetworkImage]: в памяти процесса.
/// Дискового кеша нет намеренно: он тянет отдельную зависимость с
/// нативной частью, а фотография весит ~30 КБ и приходит из публичного
/// бакета. Если понадобится — точка замены здесь одна,
/// [imageProviderFactory].
class SqAvatar extends StatelessWidget {
  const SqAvatar({
    super.key,
    required this.name,
    this.photoUrl,
    this.size = 44,
  });

  /// Подмена загрузчика изображения — для тестов, чтобы они не ходили в
  /// сеть. `null` — обычный [NetworkImage].
  @visibleForTesting
  static ImageProvider Function(String url)? imageProviderFactory;

  final String name;

  /// Одобренная фотография специалиста; `null` — показываются инициалы.
  final String? photoUrl;

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

  Widget _initialsChild() => Text(
    _initials,
    style: SqTypography.title.copyWith(
      color: Colors.white,
      fontSize: size / 2.2,
    ),
  );

  @override
  Widget build(BuildContext context) {
    final url = photoUrl;
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: _backgroundColor,
        shape: BoxShape.circle,
      ),
      clipBehavior: Clip.antiAlias,
      child: url == null || url.isEmpty
          ? _initialsChild()
          : Image(
              image: (imageProviderFactory ?? NetworkImage.new)(url),
              width: size,
              height: size,
              fit: BoxFit.cover,
              // Ошибка загрузки — штатный случай, а не исключение.
              errorBuilder: (context, error, stackTrace) =>
                  Center(child: _initialsChild()),
            ),
    );
  }
}
