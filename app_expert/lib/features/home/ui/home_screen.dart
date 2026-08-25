/// Главный экран эксперта (E7 задача 10): крупный переключатель приёма
/// заявок (`ACCEPTING`/`NOT_ACCEPTING`) и presence-heartbeat
/// (`HomeController`). Карточка «Сегодня: N заявок» и баннер активной
/// консультации заполнятся задачей 12 (список офферов/консультаций) —
/// этот экран их не блокирует.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../auth/state/auth_controller.dart';
import '../state/home_controller.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  bool _saving = false;
  String? _error;

  Future<void> _toggle(bool accepting) async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref
          .read(homeControllerProvider.notifier)
          .setStatus(accepting ? WorkStatus.accepting : WorkStatus.notAccepting);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(homeControllerProvider);

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(
        title: const Text('Главная'),
        actions: [
          IconButton(
            key: const Key('sq-logout'),
            icon: const Icon(Icons.logout),
            onPressed: () => ref.read(authControllerProvider.notifier).logout(),
          ),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Text(
            error is ApiException ? error.message : 'Не удалось загрузить профиль',
            style: SqTypography.body.copyWith(color: SqColors.danger),
          ),
        ),
        data: (me) {
          final accepting = me.workStatus == WorkStatus.accepting;
          return Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                if (me.verificationStatus != VerificationStatus.verified)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Text(
                      'Приём заявок откроется после проверки анкеты',
                      style: SqTypography.body.copyWith(color: SqColors.textSecondary),
                    ),
                  ),
                SwitchListTile(
                  key: const Key('sq-home-accepting-switch'),
                  title: Text(accepting ? 'Приём заявок включён' : 'Приём заявок выключен'),
                  value: accepting,
                  onChanged: (_saving ||
                          me.verificationStatus != VerificationStatus.verified)
                      ? null
                      : _toggle,
                ),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      _error!,
                      style: SqTypography.body.copyWith(color: SqColors.danger),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}
