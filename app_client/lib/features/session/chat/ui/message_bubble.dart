/// Пузырь сообщения переписки (прототип `12-chat.png`).
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

import '../../../../l10n/app_localizations.dart';

/// Статус доставки пузыря: подтверждённое сервером сообщение, ожидающее
/// эха или отклонённое бэкендом.
enum BubbleDelivery { delivered, sending, failed }

class MessageBubble extends StatelessWidget {
  const MessageBubble({
    super.key,
    required this.text,
    required this.isMine,
    this.createdAt,
    this.delivery = BubbleDelivery.delivered,
    this.onResend,
  });

  final String text;

  /// Своё сообщение (`senderRole == 'client'`) — вправо и цветом акцента.
  final bool isMine;

  final DateTime? createdAt;
  final BubbleDelivery delivery;
  final VoidCallback? onResend;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return Align(
      alignment: isMine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: SqSpacing.xs),
        padding: const EdgeInsets.all(SqSpacing.m),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * 0.75,
        ),
        decoration: BoxDecoration(
          color: isMine ? SqColors.chipBg : SqColors.surface,
          borderRadius: BorderRadius.circular(SqRadius.l),
          border: Border.all(color: SqColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(text, style: SqTypography.body),
            const SizedBox(height: SqSpacing.xs),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (createdAt != null)
                  Text(
                    _time(createdAt!),
                    style: SqTypography.caption.copyWith(
                      color: SqColors.textTertiary,
                    ),
                  ),
                if (delivery == BubbleDelivery.sending) ...[
                  const SizedBox(width: SqSpacing.s),
                  Text(
                    l10n.chatSending,
                    style: SqTypography.caption.copyWith(
                      color: SqColors.textTertiary,
                    ),
                  ),
                ],
                if (delivery == BubbleDelivery.failed) ...[
                  const SizedBox(width: SqSpacing.s),
                  Text(
                    l10n.chatFailed,
                    style: SqTypography.caption.copyWith(
                      color: SqColors.danger,
                    ),
                  ),
                  if (onResend != null) ...[
                    const SizedBox(width: SqSpacing.s),
                    GestureDetector(
                      onTap: onResend,
                      child: Text(
                        l10n.actionRetry,
                        style: SqTypography.caption.copyWith(
                          color: SqColors.primary,
                        ),
                      ),
                    ),
                  ],
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _time(DateTime value) =>
      '${value.hour.toString().padLeft(2, '0')}:'
      '${value.minute.toString().padLeft(2, '0')}';
}
