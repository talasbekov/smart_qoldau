/// Центр уведомлений эксперта (E7 задача 16).
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../state/notifications_controller.dart';
import 'notification_tile.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(notificationsControllerProvider);

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(
        title: const Text('Уведомления'),
        actions: [
          TextButton(
            onPressed: () => ref.read(notificationsControllerProvider.notifier).markAllRead(),
            child: const Text('Прочитать все'),
          ),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Text(
            error is ApiException ? error.message : 'Не удалось загрузить уведомления',
            style: SqTypography.body.copyWith(color: SqColors.danger),
          ),
        ),
        data: (data) {
          if (data.items.isEmpty) {
            return Center(child: Text('Пока нет уведомлений', style: SqTypography.body));
          }
          return RefreshIndicator(
            onRefresh: () => ref.read(notificationsControllerProvider.notifier).refresh(),
            child: ListView.builder(
              itemCount: data.items.length,
              itemBuilder: (context, index) {
                final notification = data.items[index];
                return NotificationTile(
                  notification: notification,
                  onTap: () {
                    ref
                        .read(notificationsControllerProvider.notifier)
                        .markRead([notification.id]);
                    final route = notificationRoute(notification);
                    if (route != null) context.push(route);
                  },
                );
              },
            ),
          );
        },
      ),
    );
  }
}
