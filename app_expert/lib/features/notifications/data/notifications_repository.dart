/// Центр уведомлений и регистрация устройства — копия
/// `app_client/lib/features/notifications/data/notifications_repository.dart`
/// (E7 задача 16).
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

class NotificationsRepository {
  const NotificationsRepository(this._api);

  final SqApi _api;

  /// `GET /notifications` — страница + счётчик непрочитанных.
  Future<NotificationsPage> page({int? take, int? skip}) =>
      _api.notifications(take: take, skip: skip);

  /// `POST /notifications/read`. Без [ids] — все свои.
  Future<void> markRead({List<String>? ids}) => _api.markNotificationsRead(ids: ids);

  /// `POST /devices` — upsert push-токена устройства.
  Future<void> registerDevice({
    required String platform,
    required String token,
    String? locale,
  }) => _api.registerDevice(platform: platform, token: token, locale: locale);
}

final notificationsRepositoryProvider = Provider<NotificationsRepository>(
  (ref) => NotificationsRepository(ref.watch(sqApiProvider)),
);
