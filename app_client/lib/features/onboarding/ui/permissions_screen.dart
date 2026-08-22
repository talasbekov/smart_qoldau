/// Экран запроса разрешений онбординга (БП-10 шаг 4): микрофон, камера,
/// уведомления — с объяснением, зачем каждое нужно, а не требованием его
/// дать.
///
/// Отказ НЕ блокирует вход: чат работает без разрешений, а аудио/видео
/// повторно запросят их в момент самого звонка (задача 14). Поэтому обе
/// кнопки — «Разрешить» и «Позже» — одинаково ведут дальше, различие
/// только в том, дёргается ли [PermissionService].
///
/// Как и `SlidesScreen`, экран сам никуда не навигирует — зовёт
/// [onFinished] и оставляет решение вызывающей стороне (маршрутизации пока
/// нет, см. `SlidesScreen`).
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../core/permission_service.dart';
import '../../../l10n/app_localizations.dart';
import '../state/onboarding_flags.dart';

class _PermissionRow {
  const _PermissionRow({
    required this.icon,
    required this.title,
    required this.description,
  });

  final IconData icon;
  final String title;
  final String description;
}

class PermissionsScreen extends ConsumerStatefulWidget {
  const PermissionsScreen({super.key, required this.onFinished});

  /// Вызывается один раз — после «Разрешить» (независимо от того, что
  /// ответила система на каждый запрос) или после «Позже».
  final VoidCallback onFinished;

  @override
  ConsumerState<PermissionsScreen> createState() => _PermissionsScreenState();
}

class _PermissionsScreenState extends ConsumerState<PermissionsScreen> {
  bool _requesting = false;

  /// `if (_requesting) return;` в начале — тот же приём, что
  /// `_continueAnonymously` на `WelcomeScreen`/`_guardedFinish` на
  /// `SlidesScreen`: `onPressed`, захваченный в уже построенном дереве, не
  /// обновится до следующего `pump()`, поэтому без внутреннего guard'а
  /// быстрый повторный тап по «Разрешить» до первого кадра после `setState`
  /// мог бы запустить второй, независимый набор запросов разрешений.
  ///
  /// `await`-цепочка — в `try/catch/finally`, по образцу
  /// `_continueAnonymously` на `WelcomeScreen`: если `PermissionService
  /// .request` (или сам [_finish]) бросит, `_requesting` обязан
  /// сброситься всё равно — иначе «Разрешить»/«Позже» останутся
  /// заблокированы навсегда. Исключение гасится молча: отказ и так не
  /// блокирует вход (см. шапку файла), поэтому сбой запроса — тем более
  /// не повод ронять экран или показывать ошибку.
  Future<void> _allow() async {
    if (_requesting) return;
    setState(() => _requesting = true);
    try {
      final service = ref.read(permissionServiceProvider);
      await service.request(SqPermission.microphone);
      await service.request(SqPermission.camera);
      await service.request(SqPermission.notifications);
      await _finish();
    } catch (_) {
      // Намеренно молча — см. комментарий выше.
    } finally {
      if (mounted) setState(() => _requesting = false);
    }
  }

  /// Тот же guard и та же гарантия сброса флага, что в [_allow] — «Позже»
  /// ничего не запрашивает, но без собственного guard'а был бы уязвим к
  /// точно такому же двойному тапу по самому себе.
  Future<void> _later() async {
    if (_requesting) return;
    setState(() => _requesting = true);
    try {
      await _finish();
    } catch (_) {
      // Намеренно молча — см. комментарий у [_allow].
    } finally {
      if (mounted) setState(() => _requesting = false);
    }
  }

  Future<void> _finish() async {
    await ref.read(onboardingFlagsProvider).setAskedPermissions(true);
    if (!mounted) return;
    widget.onFinished();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final rows = [
      _PermissionRow(
        icon: Icons.mic_none,
        title: l10n.permissionMicrophoneTitle,
        description: l10n.permissionMicrophoneDescription,
      ),
      _PermissionRow(
        icon: Icons.videocam_outlined,
        title: l10n.permissionCameraTitle,
        description: l10n.permissionCameraDescription,
      ),
      _PermissionRow(
        icon: Icons.notifications_none,
        title: l10n.permissionNotificationsTitle,
        description: l10n.permissionNotificationsDescription,
      ),
    ];

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(title: Text(l10n.permissionsTitle)),
      body: Padding(
        padding: const EdgeInsets.all(SqSpacing.l),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              l10n.permissionsSubtitle,
              style: SqTypography.body.copyWith(color: SqColors.textSecondary),
            ),
            const SizedBox(height: SqSpacing.l),
            Expanded(
              child: ListView.separated(
                itemCount: rows.length,
                separatorBuilder: (_, _) => const SizedBox(height: SqSpacing.m),
                itemBuilder: (context, index) =>
                    _PermissionTile(row: rows[index]),
              ),
            ),
            const SizedBox(height: SqSpacing.l),
            SqButton(
              label: l10n.actionAllow,
              loading: _requesting,
              onPressed: _requesting ? null : _allow,
            ),
            const SizedBox(height: SqSpacing.s),
            SqButton(
              kind: SqButtonKind.secondary,
              label: l10n.actionLater,
              onPressed: _requesting ? null : _later,
            ),
          ],
        ),
      ),
    );
  }
}

class _PermissionTile extends StatelessWidget {
  const _PermissionTile({required this.row});

  final _PermissionRow row;

  @override
  Widget build(BuildContext context) {
    return SqCard(
      child: Row(
        children: [
          Icon(row.icon, color: SqColors.primary),
          const SizedBox(width: SqSpacing.m),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(row.title, style: SqTypography.title),
                const SizedBox(height: SqSpacing.xs),
                Text(
                  row.description,
                  style: SqTypography.caption.copyWith(
                    color: SqColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
