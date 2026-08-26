/// Профиль клиента (прототип `23-profile.png`): гостевой блок конверсии,
/// пункты настроек и выход.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/error_text.dart';
import '../../../core/legal_links.dart';
import '../../../core/locale_controller.dart';
import '../../../core/route_paths.dart';
import '../../../core/url_launcher_port.dart';
import '../../../l10n/app_localizations.dart';
import '../../auth/state/auth_controller.dart';
import '../../consultations/data/consultations_repository.dart';

/// Сколько консультаций спрашиваем ради счётчика в профиле. Отдельного
/// эндпоинта «сколько у меня завершённых» бэкенд не даёт, поэтому берём
/// страницу и, если она заполнилась целиком, показываем «N+» вместо
/// заведомо неточного числа.
const _completedCountPageSize = 100;

final _completedConsultationsProvider = FutureProvider.autoDispose<int>((
  ref,
) async {
  final list = await ref
      .read(consultationsRepositoryProvider)
      .list(status: ConsultationStatus.completed, take: _completedCountPageSize);
  return list.length;
});

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  String? _error;

  Future<void> _logout({required bool isGuest}) async {
    final l10n = AppLocalizations.of(context)!;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l10n.profileLogoutTitle),
        content: Text(
          // Гостю выход стоит данных: сессия привязана к устройству и
          // восстановить её нечем (Р-22). Об этом нужно сказать прямо.
          isGuest ? l10n.profileLogoutGuestBody : l10n.profileLogoutBody,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(l10n.actionClose),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(
              l10n.profileLogout,
              style: const TextStyle(color: SqColors.danger),
            ),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    await ref.read(authControllerProvider.notifier).logout();
    if (mounted) context.go(RoutePaths.welcome);
  }

  /// «Удалить аккаунт» — `DELETE /me` (ТЗ §5.1). Раньше здесь заводилось
  /// обращение в поддержку, потому что эндпоинта не существовало; теперь
  /// удаление выполняется сразу, а поддержка остаётся запасным путём для
  /// специалистов, которым удаление через приложение закрыто.
  Future<void> _deleteAccount() async {
    final l10n = AppLocalizations.of(context)!;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l10n.profileDeleteAccountTitle),
        content: Text(l10n.profileDeleteAccountBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(l10n.actionClose),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(
              l10n.profileDeleteAccount,
              style: const TextStyle(color: SqColors.danger),
            ),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    try {
      await ref.read(authControllerProvider.notifier).deleteAccount();
      if (mounted) context.go(RoutePaths.welcome);
    } on ApiException catch (error) {
      if (!mounted) return;
      // Отказы удаления объясняются своими словами: сообщение бэкенда
      // русское, а приложение обязано говорить и по-казахски.
      setState(() => _error = switch (error.code) {
            ApiErrorCode.consultationInProgress =>
              l10n.profileDeleteAccountBlockedConsultation,
            ApiErrorCode.paymentInProgress =>
              l10n.profileDeleteAccountBlockedPayment,
            _ => errorText(context, error),
          });
    }
  }

  Future<void> _pickLanguage() async {
    final l10n = AppLocalizations.of(context)!;
    final locale = await showModalBottomSheet<Locale>(
      context: context,
      backgroundColor: SqColors.surface,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              key: const Key('sq-profile-locale-ru'),
              title: Text(l10n.languageRussian),
              onTap: () => Navigator.of(sheetContext).pop(const Locale('ru')),
            ),
            ListTile(
              key: const Key('sq-profile-locale-kk'),
              title: Text(l10n.languageKazakh),
              onTap: () => Navigator.of(sheetContext).pop(const Locale('kk')),
            ),
          ],
        ),
      ),
    );
    if (locale == null) return;
    await ref.read(localeControllerProvider.notifier).setLocale(locale);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final auth = ref.watch(authControllerProvider).valueOrNull;
    final isGuest = auth is AuthGuest;
    final phone = switch (auth) {
      AuthRegistered(:final user) => user.phone,
      _ => null,
    };
    final completed = ref.watch(_completedConsultationsProvider).valueOrNull;

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(title: Text(l10n.navProfile)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(SqSpacing.l),
          children: [
            if (isGuest)
              SqCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l10n.profileGuestTitle, style: SqTypography.h2),
                    const SizedBox(height: SqSpacing.s),
                    Text(
                      l10n.profileGuestBody,
                      style: SqTypography.body.copyWith(
                        color: SqColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: SqSpacing.m),
                    SqButton(
                      key: const Key('sq-profile-create-account'),
                      label: l10n.profileCreateAccount,
                      onPressed: () => context.push(RoutePaths.convertGuest),
                    ),
                  ],
                ),
              )
            else
              SqCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (phone != null)
                      Text(phone, style: SqTypography.h2),
                    if (completed != null) ...[
                      const SizedBox(height: SqSpacing.s),
                      Text(
                        completed >= _completedCountPageSize
                            ? '${l10n.profileCompletedConsultations(completed)}+'
                            : l10n.profileCompletedConsultations(completed),
                        style: SqTypography.body.copyWith(
                          color: SqColors.textSecondary,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            const SizedBox(height: SqSpacing.l),
            _Item(
              label: l10n.favoritesTitle,
              icon: Icons.favorite_border,
              onTap: () => context.push(RoutePaths.favorites),
            ),
            _Item(
              label: l10n.profilePaymentMethods,
              icon: Icons.credit_card,
              onTap: () => context.push(RoutePaths.cards),
            ),
            _Item(
              label: l10n.profileNotifications,
              icon: Icons.notifications_none,
              onTap: () => context.push(RoutePaths.notifications),
            ),
            _Item(
              label: l10n.profileLanguage,
              icon: Icons.language,
              onTap: _pickLanguage,
            ),
            _Item(
              label: l10n.profileSupport,
              icon: Icons.support_agent_outlined,
              onTap: () => context.push(RoutePaths.support),
            ),
            _Item(
              label: l10n.profileTerms,
              icon: Icons.description_outlined,
              onTap: () => ref.read(urlLauncherPortProvider).launch(termsUrl),
            ),
            _Item(
              label: l10n.profilePrivacy,
              icon: Icons.privacy_tip_outlined,
              onTap: () => ref.read(urlLauncherPortProvider).launch(privacyUrl),
            ),
            const SizedBox(height: SqSpacing.l),
            if (_error != null) ...[
              Text(
                _error!,
                key: const Key('sq-profile-error'),
                style: SqTypography.body.copyWith(color: SqColors.danger),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: SqSpacing.m),
            ],
            _Item(
              label: l10n.profileDeleteAccount,
              icon: Icons.delete_outline,
              danger: true,
              onTap: _deleteAccount,
            ),
            _Item(
              label: l10n.profileLogout,
              icon: Icons.logout,
              danger: true,
              onTap: () => _logout(isGuest: isGuest),
            ),
          ],
        ),
      ),
    );
  }
}

class _Item extends StatelessWidget {
  const _Item({
    required this.label,
    required this.icon,
    required this.onTap,
    this.danger = false,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;
  final bool danger;

  @override
  Widget build(BuildContext context) => ListTile(
    key: Key('sq-profile-item-$label'),
    leading: Icon(icon, color: danger ? SqColors.danger : SqColors.primary),
    title: Text(
      label,
      style: SqTypography.body.copyWith(
        color: danger ? SqColors.danger : SqColors.textPrimary,
      ),
    ),
    onTap: onTap,
  );
}
