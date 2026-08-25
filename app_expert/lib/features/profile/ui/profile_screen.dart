/// Профиль эксперта (E7 задача 16): имя, кнопка выхода, смена языка
/// (`PATCH /me/locale` через `LocaleController` — UI пока не локализован,
/// см. `core/locale_controller.dart`), центр уведомлений.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/locale_controller.dart';
import '../../../core/route_paths.dart';
import '../../auth/state/auth_controller.dart';
import '../../home/state/home_controller.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(homeControllerProvider).valueOrNull;
    final locale = ref.watch(localeControllerProvider);

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(title: const Text('Профиль')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (me != null)
            Text(me.displayName, style: SqTypography.h2)
          else
            const SizedBox.shrink(),
          const SizedBox(height: 24),
          ListTile(
            key: const Key('sq-profile-notifications'),
            leading: const Icon(Icons.notifications_outlined),
            title: const Text('Уведомления'),
            onTap: () => context.push(RoutePaths.notifications),
          ),
          ListTile(
            leading: const Icon(Icons.language),
            title: const Text('Язык'),
            trailing: DropdownButton<Locale>(
              key: const Key('sq-profile-locale'),
              value: locale,
              items: const [
                DropdownMenuItem(value: Locale('ru'), child: Text('Русский')),
                DropdownMenuItem(value: Locale('kk'), child: Text('Қазақша')),
              ],
              onChanged: (value) {
                if (value != null) {
                  ref.read(localeControllerProvider.notifier).setLocale(value);
                }
              },
            ),
          ),
          const SizedBox(height: 24),
          ListTile(
            key: const Key('sq-logout'),
            leading: const Icon(Icons.logout),
            title: const Text('Выйти'),
            onTap: () => ref.read(authControllerProvider.notifier).logout(),
          ),
        ],
      ),
    );
  }
}
