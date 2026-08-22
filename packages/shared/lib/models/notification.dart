import 'package:freezed_annotation/freezed_annotation.dart';

part 'notification.freezed.dart';
part 'notification.g.dart';

/// Уведомление (`NotificationDto`). `type` — точечная строка вида
/// `earning.credited`, у бэкенда это не enum.
@freezed
abstract class AppNotification with _$AppNotification {
  const factory AppNotification({
    required String id,
    required String type,
    required String title,
    required String body,
    required Map<String, dynamic> data,
    required DateTime? readAt,
    required DateTime createdAt,
  }) = _AppNotification;

  factory AppNotification.fromJson(Map<String, dynamic> json) =>
      _$AppNotificationFromJson(json);
}

/// Страница центра уведомлений (`NotificationsListDto`).
@freezed
abstract class NotificationsPage with _$NotificationsPage {
  const factory NotificationsPage({
    required List<AppNotification> items,
    required int unreadCount,
  }) = _NotificationsPage;

  factory NotificationsPage.fromJson(Map<String, dynamic> json) =>
      _$NotificationsPageFromJson(json);
}
