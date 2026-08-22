/// Тайл одного уведомления и разбор дип-линка по его типу.
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

import '../../../core/route_paths.dart';

/// Куда ведёт уведомление [notification]. `null` — переходить некуда:
/// тайл всё равно рисуется и отмечается прочитанным.
///
/// Экспертные типы (`offer.*`, `earning.*`, `payout.*`, `verification.*`)
/// клиенту по контракту не приходят; если бэкенд когда-нибудь пришлёт их
/// по ошибке, центр уведомлений обязан это пережить, а не упасть.
String? notificationRoute(AppNotification notification) {
  switch (notification.type) {
    case 'chat.message':
      final consultationId = notification.data['consultationId'];
      return consultationId is String
          ? RoutePaths.session(consultationId)
          : null;
    case 'consultation.cancelled':
    case 'consultation.completed':
      return RoutePaths.consultations;
    case 'ticket.replied':
      final ticketId = notification.data['ticketId'];
      // Экран обращения появляется в задаче 19; до тех пор ведём в
      // поддержку общим путём, а не в несуществующий маршрут.
      return ticketId is String ? RoutePaths.support : null;
    default:
      return null;
  }
}

class NotificationTile extends StatelessWidget {
  const NotificationTile({
    super.key,
    required this.notification,
    required this.onTap,
  });

  final AppNotification notification;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final unread = notification.readAt == null;

    return Padding(
      padding: const EdgeInsets.only(bottom: SqSpacing.m),
      child: InkWell(
        key: Key('sq-notification-${notification.id}'),
        onTap: onTap,
        borderRadius: BorderRadius.circular(SqRadius.m),
        child: SqCard(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                unread ? Icons.circle : Icons.circle_outlined,
                size: 10,
                color: unread ? SqColors.accent : SqColors.textTertiary,
              ),
              const SizedBox(width: SqSpacing.m),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      notification.title,
                      style: unread
                          ? SqTypography.title
                          : SqTypography.body.copyWith(
                              color: SqColors.textSecondary,
                            ),
                    ),
                    const SizedBox(height: SqSpacing.xs),
                    Text(
                      notification.body,
                      style: SqTypography.body.copyWith(
                        color: SqColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
