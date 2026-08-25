/// Оболочка авторизованного эксперта — заглушка.
///
/// Вкладок навигации пока нет (появятся в задачах расписания/заявок/
/// заработка следующих задач эпика E7); задача 1 отдаёт минимальный экран,
/// чтобы редирект-гарду `router.dart` было куда вести уже вошедшего
/// эксперта, и даёт кнопку выхода, чтобы цикл авторизации был проверяем
/// вручную до появления настоящих фич.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../auth/state/auth_controller.dart';

class AppShell extends ConsumerWidget {
  const AppShell({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(
        title: const Text('Кабинет специалиста'),
        actions: [
          IconButton(
            key: const Key('sq-logout'),
            icon: const Icon(Icons.logout),
            onPressed: () =>
                ref.read(authControllerProvider.notifier).logout(),
          ),
        ],
      ),
      body: Center(
        child: Text(
          'Скоро здесь появится расписание, заявки и заработок',
          textAlign: TextAlign.center,
          style: SqTypography.body.copyWith(color: SqColors.textSecondary),
        ),
      ),
    );
  }
}
