/// Центр уведомлений: список, отметка прочтения и переходы по дип-линкам.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/error_text.dart';
import '../../../l10n/app_localizations.dart';
import '../state/notifications_controller.dart';
import 'notification_tile.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  Future<void> _open(
    BuildContext context,
    WidgetRef ref,
    AppNotification notification,
  ) async {
    final route = notificationRoute(notification);
    if (notification.readAt == null) {
      await ref
          .read(notificationsControllerProvider.notifier)
          .markRead([notification.id]);
    }
    if (route == null || !context.mounted) return;
    context.push(route);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final notifications = ref.watch(notificationsControllerProvider);

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(
        title: Text(l10n.notificationsTitle),
        actions: [
          TextButton(
            key: const Key('sq-notifications-read-all'),
            onPressed: () => ref
                .read(notificationsControllerProvider.notifier)
                .markAllRead(),
            child: Text(l10n.notificationsMarkAllRead),
          ),
        ],
      ),
      body: SafeArea(
        child: notifications.when(
          loading: () => const Center(child: SqLoader()),
          error: (error, stackTrace) => Center(
            child: Padding(
              padding: const EdgeInsets.all(SqSpacing.l),
              child: SqErrorView(
                text: error is ApiException
                    ? errorText(context, error)
                    : l10n.errorGeneric,
                onRetry: () =>
                    ref.read(notificationsControllerProvider.notifier).refresh(),
                retryLabel: l10n.actionRetry,
              ),
            ),
          ),
          data: (state) => state.items.isEmpty
              ? Center(
                  child: SqEmptyState(
                    icon: Icons.notifications_none,
                    title: l10n.notificationsEmpty,
                  ),
                )
              : RefreshIndicator(
                  onRefresh: () => ref
                      .read(notificationsControllerProvider.notifier)
                      .refresh(),
                  child: ListView(
                    padding: const EdgeInsets.all(SqSpacing.l),
                    children: [
                      for (final notification in state.items)
                        NotificationTile(
                          notification: notification,
                          onTap: () => _open(context, ref, notification),
                        ),
                      Center(
                        child: TextButton(
                          key: const Key('sq-notifications-load-more'),
                          onPressed: state.loadingMore
                              ? null
                              : () => ref
                                    .read(
                                      notificationsControllerProvider.notifier,
                                    )
                                    .loadMore(),
                          child: Text(l10n.consultationLoadMore),
                        ),
                      ),
                    ],
                  ),
                ),
        ),
      ),
    );
  }
}
