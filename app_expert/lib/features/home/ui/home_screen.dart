/// Главный экран эксперта (E7 задача 10): крупный переключатель приёма
/// заявок (`ACCEPTING`/`NOT_ACCEPTING`) и presence-heartbeat
/// (`HomeController`), плюс переходы на расписание (задача 8) и заявки/
/// консультации (задача 12) — больше некуда вести с главного экрана,
/// навигационной оболочки со вкладками план E7 не заводит.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/route_paths.dart';
import '../../../l10n/app_localizations.dart';
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
    final l10n = AppLocalizations.of(context)!;

    // Свежезарегистрированный телефон ещё не имеет анкеты эксперта —
    // `GET /experts/me` отвечает 404 EXPERT_NOT_FOUND. Ни один экран до
    // этого не заводил автоматический переход в онбординг (см. брифинг
    // задачи 4: «заведёт задача 6», но задача 6 — только фото/статус
    // верификации, а не сам переход) — без него новый эксперт упирался бы
    // в тупиковый экран ошибки без всякого выхода.
    ref.listen(homeControllerProvider, (previous, next) {
      final error = next.error;
      if (error is ApiException && error.code == ApiErrorCode.expertNotFound) {
        context.go(RoutePaths.onboardingProfile);
      }
    });

    final async = ref.watch(homeControllerProvider);

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(
        title: Text(l10n.homeScreenTitle),
        actions: [
          IconButton(
            key: const Key('sq-home-profile'),
            icon: const Icon(Icons.person_outline),
            onPressed: () => context.push(RoutePaths.profile),
          ),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Text(
            error is ApiException ? error.message : l10n.errorLoadFailed,
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
                      l10n.homeAcceptingBlockedByVerification,
                      style: SqTypography.body.copyWith(color: SqColors.textSecondary),
                    ),
                  ),
                SwitchListTile(
                  key: const Key('sq-home-accepting-switch'),
                  title: Text(accepting ? l10n.homeAcceptingOn : l10n.homeAcceptingOff),
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
                const SizedBox(height: 16),
                ListTile(
                  key: const Key('sq-home-consultations'),
                  leading: const Icon(Icons.list_alt),
                  title: Text(l10n.homeNavConsultations),
                  onTap: () => context.push(RoutePaths.consultations),
                ),
                ListTile(
                  key: const Key('sq-home-schedule'),
                  leading: const Icon(Icons.calendar_month),
                  title: Text(l10n.scheduleScreenTitle),
                  onTap: () => context.push(RoutePaths.schedule),
                ),
                ListTile(
                  key: const Key('sq-home-earnings'),
                  leading: const Icon(Icons.payments_outlined),
                  title: Text(l10n.homeNavEarnings),
                  onTap: () => context.push(RoutePaths.earnings),
                ),
                ListTile(
                  key: const Key('sq-home-reviews'),
                  leading: const Icon(Icons.star_border),
                  title: Text(l10n.homeNavReviews),
                  onTap: () => context.push(RoutePaths.reviews),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
