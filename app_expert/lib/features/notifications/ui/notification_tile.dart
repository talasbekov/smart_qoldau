/// Разбор маршрута уведомления и его тайл в списке — копия
/// `app_client/lib/features/notifications/ui/notification_tile.dart` (E7
/// задача 16), маршруты — экспертские (см. `RoutePaths`).
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

import '../../../core/route_paths.dart';

/// Резолвит маршрут уведомления по его типу — та же точка разбора, что
/// `PushBootstrap.pushRouteResolverProvider` использует для тапа по пушу
/// (см. `main.dart`), чтобы список и пуш не разошлись в правилах.
String? notificationRoute(AppNotification notification) {
  switch (notification.type) {
    case 'offer.incoming':
      return RoutePaths.consultations;
    case 'chat.message':
      final consultationId = notification.data['consultationId'];
      return consultationId is String
          ? RoutePaths.session(consultationId)
          : null;
    case 'consultation.cancelled':
    case 'consultation.booked':
    case 'consultation.rescheduled':
    case 'consultation.reminder':
      return RoutePaths.consultations;
    case 'earning.credited':
    case 'payout.paid':
    case 'payout.rejected':
      return RoutePaths.earnings;
    case 'verification.approved':
    case 'verification.rejected':
      return RoutePaths.verificationStatus;
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
    return ListTile(
      key: Key('sq-notification-${notification.id}'),
      onTap: onTap,
      tileColor: unread ? SqColors.chipBg : null,
      leading: Icon(
        unread ? Icons.circle : Icons.circle_outlined,
        size: 10,
        color: SqColors.primary,
      ),
      title: Text(notification.title, style: SqTypography.title),
      subtitle: Text(notification.body, style: SqTypography.body),
    );
  }
}
