/// Корневой виджет приложения эксперта SmartQoldau.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import 'router.dart';

/// Аналог `SqClientApp` из `app_client`, но без локализации (задача 1 её не
/// заводит — появится вместе с онбординг-анкетой, если понадобится) и без
/// гостевого режима (см. `features/auth/state/auth_controller.dart`).
class SqExpertApp extends ConsumerWidget {
  const SqExpertApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'SmartQoldau Эксперт',
      theme: sqTheme(),
      routerConfig: router,
    );
  }
}
