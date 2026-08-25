/// Экран заставки: восстанавливает сессию при старте приложения и отдаёт
/// результат наружу — сам он никуда не навигирует, решение, куда вести
/// эксперта дальше по [AuthState], принимает `router.dart`.
library;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../state/auth_controller.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key, required this.onRestored});

  /// Вызывается ровно один раз, когда восстановление сессии завершилось.
  final void Function(BuildContext context, AuthState state) onRestored;

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    // ref.read() до того как виджет вставлен в дерево и первый кадр
    // построен — не гарантированно безопасно, поэтому восстановление
    // запускаем постфреймом, а не прямо в initState.
    SchedulerBinding.instance.addPostFrameCallback((_) => _restore());
  }

  Future<void> _restore() async {
    await ref.read(authControllerProvider.notifier).restore();
    if (!mounted) return;
    final state = ref.read(authControllerProvider).value;
    if (state != null) {
      widget.onRestored(context, state);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: SqColors.background,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('SmartQoldau Эксперт', style: SqTypography.h1),
            const SizedBox(height: SqSpacing.s),
            Text(
              'Загружаем ваш кабинет…',
              style: SqTypography.body.copyWith(color: SqColors.textSecondary),
            ),
            const SizedBox(height: SqSpacing.xxl),
            const SqLoader(),
          ],
        ),
      ),
    );
  }
}
