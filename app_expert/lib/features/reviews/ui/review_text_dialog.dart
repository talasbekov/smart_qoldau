/// Диалог ввода текста для ответа на отзыв и для жалобы (E7 задача 15).
///
/// Один виджет на оба действия: у бэкенда `ReplyReviewDto` и
/// `ComplaintReviewDto` — буквально одно и то же поле `text` 1..1000, а
/// различаются заголовок, подсказка и подпись кнопки. Возвращает введённый
/// текст или `null`, если эксперт закрыл диалог.
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';

/// Максимум из `ReplyReviewDto`/`ComplaintReviewDto` (`@MaxLength(1000)`) —
/// обрезаем на клиенте, чтобы не ловить 400 VALIDATION_FAILED.
const reviewTextMaxLength = 1000;

class ReviewTextDialog extends StatefulWidget {
  const ReviewTextDialog({
    super.key,
    required this.title,
    required this.hint,
    required this.confirmLabel,
    this.initialText,
  });

  final String title;
  final String hint;
  final String confirmLabel;
  final String? initialText;

  @override
  State<ReviewTextDialog> createState() => _ReviewTextDialogState();
}

class _ReviewTextDialogState extends State<ReviewTextDialog> {
  late final TextEditingController _controller =
      TextEditingController(text: widget.initialText ?? '');

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return AlertDialog(
      title: Text(widget.title, style: SqTypography.title),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            widget.hint,
            style: SqTypography.caption.copyWith(color: SqColors.textSecondary),
          ),
          const SizedBox(height: 12),
          TextField(
            key: const Key('sq-review-text'),
            controller: _controller,
            maxLines: 5,
            maxLength: reviewTextMaxLength,
            autofocus: true,
          ),
        ],
      ),
      actions: [
        TextButton(
          key: const Key('sq-review-text-cancel'),
          onPressed: () => Navigator.of(context).pop(),
          child: Text(l10n.actionCancel),
        ),
        ElevatedButton(
          key: const Key('sq-review-text-confirm'),
          // Пустой текст бэкенд отверг бы (`@MinLength(1)`) — кнопку
          // просто не даём нажать.
          onPressed: () {
            final text = _controller.text.trim();
            if (text.isEmpty) return;
            Navigator.of(context).pop(text);
          },
          child: Text(widget.confirmLabel),
        ),
      ],
    );
  }
}
