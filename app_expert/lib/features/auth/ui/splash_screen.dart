/// Экран заставки: восстанавливает сессию при старте приложения. Сам он
/// никуда не навигирует и никого об этом не уведомляет — навигация решается
/// целиком реактивно, `router.dart`'ом (`_AuthRefreshNotifier` слушает
/// `authControllerProvider`, а `_redirect` решает, куда вести эксперта по
/// свежему [AuthState]) — как только `restore()` меняет состояние, гард сам
/// пересчитывается и уводит с этого экрана.
library;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';
import '../state/auth_controller.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

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
    SchedulerBinding.instance.addPostFrameCallback(
      (_) => ref.read(authControllerProvider.notifier).restore(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      backgroundColor: SqColors.background,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(l10n.appTitle, style: SqTypography.h1),
            const SizedBox(height: SqSpacing.s),
            Text(
              l10n.splashLoading,
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
