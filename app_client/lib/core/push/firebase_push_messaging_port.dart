/// Реализация [PushMessagingPort] поверх Firebase Messaging.
///
/// Единственное место проекта, знающее про `firebase_*` и
/// `flutter_local_notifications`. Юнит-тестами не покрыто сознательно: всё
/// внутри — платформенные каналы, которых в headless-тесте нет; проверяется
/// логика над портом (`push_bootstrap_test.dart`), а сама обёртка — ручным
/// прогоном на устройстве с настоящим проектом Firebase.
library;

import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'push_messaging_port.dart';

/// Фоновый обработчик обязан быть точкой входа верхнего уровня: Flutter
/// поднимает для него отдельный изолят, и обычный метод класса туда не
/// передать.
@pragma('vm:entry-point')
Future<void> sqFirebaseBackgroundHandler(RemoteMessage message) async {
  // В фоне ничего не рисуем и никуда не ходим: системное уведомление
  // показывает сама платформа по `notification`-части пуша, а состояние
  // приложения подтянется при открытии (центр уведомлений — источник
  // истины, см. задачу 18).
  await Firebase.initializeApp();
}

class FirebasePushMessagingPort implements PushMessagingPort {
  FirebasePushMessagingPort();

  final FlutterLocalNotificationsPlugin _local =
      FlutterLocalNotificationsPlugin();

  /// Канал для форграунд-уведомлений. Android требует канал явно, иначе
  /// уведомление не покажется вовсе.
  static const _androidChannel = AndroidNotificationChannel(
    'sq_default',
    'SmartQoldau',
    importance: Importance.high,
  );

  @override
  Future<void> initialize() async {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(sqFirebaseBackgroundHandler);

    await _local.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      ),
    );
    await _local
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.createNotificationChannel(_androidChannel);
  }

  @override
  Future<bool> requestPermission() async {
    final settings = await FirebaseMessaging.instance.requestPermission();
    return settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional;
  }

  @override
  Future<String?> token() => FirebaseMessaging.instance.getToken();

  @override
  Stream<String> get tokenRefresh => FirebaseMessaging.instance.onTokenRefresh;

  @override
  Stream<PushMessage> get onForegroundMessage =>
      FirebaseMessaging.onMessage.map(_toPushMessage);

  @override
  Stream<PushMessage> get onMessageOpened =>
      FirebaseMessaging.onMessageOpenedApp.map(_toPushMessage);

  @override
  Future<PushMessage?> takeInitialMessage() async {
    final message = await FirebaseMessaging.instance.getInitialMessage();
    return message == null ? null : _toPushMessage(message);
  }

  /// Показ локального уведомления для пуша, пришедшего в форграунде.
  Future<void> showLocal(PushMessage message) => _local.show(
    id: message.hashCode,
    title: message.title,
    body: message.body,
    notificationDetails: NotificationDetails(
      android: AndroidNotificationDetails(
        _androidChannel.id,
        _androidChannel.name,
        importance: Importance.high,
      ),
      iOS: const DarwinNotificationDetails(),
    ),
  );

  PushMessage _toPushMessage(RemoteMessage message) => PushMessage(
    title: message.notification?.title ?? '',
    body: message.notification?.body ?? '',
    data: message.data,
  );
}
