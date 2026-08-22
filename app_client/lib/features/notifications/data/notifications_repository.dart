/// Центр уведомлений и регистрация устройства.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../core/providers.dart';

class NotificationsRepository {
  const NotificationsRepository(this._api);

  final SqApi _api;

  /// `GET /v1/notifications` — страница + счётчик непрочитанных.
  Future<NotificationsPage> page({int? take, int? skip}) =>
      _api.notifications(take: take, skip: skip);

  /// `POST /v1/notifications/read`. Без [ids] — все свои (контракт
  /// бэкенда); пустой список означал бы «ни одного», поэтому его сюда
  /// передавать нельзя.
  Future<void> markRead({List<String>? ids}) =>
      _api.markNotificationsRead(ids: ids);

  /// `POST /v1/devices` — upsert push-токена устройства.
  Future<void> registerDevice({
    required String platform,
    required String token,
    String? locale,
  }) => _api.registerDevice(platform: platform, token: token, locale: locale);
}

final notificationsRepositoryProvider = Provider<NotificationsRepository>(
  (ref) => NotificationsRepository(ref.watch(sqApiProvider)),
);
