/// Экран запроса разрешений онбординга (БП-10 шаг 4): микрофон, камера,
/// уведомления — с объяснением, зачем каждое нужно, а не требованием его
/// дать.
///
/// Отказ НЕ блокирует вход: чат работает без разрешений, а аудио/видео
/// повторно запросят их в момент самого звонка (задача 14). Поэтому обе
/// кнопки — «Разрешить» и «Позже» — одинаково ведут дальше, различие
/// только в том, дёргается ли [PermissionService]. Это касается и сбоя
/// самого запроса (не отказа пользователя, а аварии механизма) — экран
/// покажет `SnackBar`, но всё равно пропустит пользователя дальше, а не
/// оставит его перед немой кнопкой.
///
/// Как и `SlidesScreen`, экран сам никуда не навигирует — зовёт
/// [onFinished] и оставляет решение вызывающей стороне (маршрутизации пока
/// нет, см. `SlidesScreen`).
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../core/error_text.dart';
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
  /// ответила система на каждый запрос, и даже если сам запрос
  /// провалился) или после «Позже».
  final VoidCallback onFinished;

  @override
  ConsumerState<PermissionsScreen> createState() => _PermissionsScreenState();
}

class _PermissionsScreenState extends ConsumerState<PermissionsScreen> {
  /// `_requesting`/`_skipping` — раздельные флаги для «Разрешить» и
  /// «Позже»: `loading` каждой кнопки завязан на СВОЙ флаг (крутить
  /// спиннер должна только нажатая кнопка), а [_busy] (обе кнопки
  /// заблокированы) — их дизъюнкция. До этого разделения обе кнопки
  /// делили один флаг `_requesting`, и «Позже» подсвечивало спиннером
  /// соседнюю кнопку «Разрешить» — тот же флаг был у неё в `loading:`.
  bool _requesting = false;
  bool _skipping = false;

  bool get _busy => _requesting || _skipping;

  /// `if (_busy) return;` в начале — тот же приём, что
  /// `_continueAnonymously` на `WelcomeScreen`/`_guardedFinish` на
  /// `SlidesScreen`: `onPressed`, захваченный в уже построенном дереве, не
  /// обновится до следующего `pump()`, поэтому без внутреннего guard'а
  /// быстрый повторный тап по «Разрешить» (в том числе пока летит
  /// «Позже», и наоборот) до первого кадра после `setState` мог бы
  /// запустить второй, независимый набор запросов разрешений.
  ///
  /// Отказ пользователя дать разрешение НЕ бросает исключение —
  /// `PermissionService.request()` в этом случае просто завершается
  /// нормально (см. `core/permission_service.dart`), это ожидаемый исход
  /// БП-10. Исключение здесь означает сбой самого МЕХАНИЗМА запроса
  /// (например, платформенный канал недоступен) — аварийный случай,
  /// который экран обязан показать пользователю (`SnackBar`, как
  /// `_continueAnonymously`) и оставить след в логе, но который тоже не
  /// должен запирать онбординг: `_finish()` ниже вызывается в любом
  /// случае, успешном или нет.
  Future<void> _allow() async {
    if (_busy) return;
    setState(() => _requesting = true);
    try {
      final service = ref.read(permissionServiceProvider);
      final error = await _requestAll(service);
      if (error != null) _showFailureSnackBar(error);
      await _finish();
    } finally {
      if (mounted) setState(() => _requesting = false);
    }
  }

  /// Запрашивает [SqPermission.microphone]/`.camera`/`.notifications`
  /// НЕЗАВИСИМО друг от друга: сбой самого механизма запроса одного из них
  /// не должен отменять оставшиеся два (до этого разделения все три шли
  /// последовательными `await` внутри одного `try` — сбой на первом же
  /// обрывал цепочку, и пользователь, тапнувший «Разрешить», не получал ни
  /// одного из трёх разрешений вместо потенциальных двух). Возвращает
  /// первую пойманную ошибку, если таковая была, — по ней [_allow] покажет
  /// ровно один `SnackBar`, а не по одному на каждый сбойный запрос.
  Future<Object?> _requestAll(PermissionService service) async {
    Object? firstError;
    for (final permission in SqPermission.values) {
      try {
        await service.request(permission);
      } catch (error, stack) {
        debugPrint(
          'PermissionsScreen: запрос $permission не удался: $error\n$stack',
        );
        firstError ??= error;
      }
    }
    return firstError;
  }

  /// Тот же guard и та же гарантия сброса флага, что в [_allow] — «Позже»
  /// ничего не запрашивает, но без собственного guard'а был бы уязвим к
  /// точно такому же двойному тапу по самому себе.
  Future<void> _later() async {
    if (_busy) return;
    setState(() => _skipping = true);
    try {
      await _finish();
    } finally {
      if (mounted) setState(() => _skipping = false);
    }
  }

  /// Единственное место, где экран трогает `context` после `await` —
  /// `mounted` проверяется прямо здесь, а не дублируется ещё и на месте
  /// вызова: сообщение (через `errorText` для `ApiException`, иначе общий
  /// `l10n.errorGeneric`) строится тут же, а не заранее в [_allow].
  void _showFailureSnackBar(Object error) {
    if (!mounted) return;
    final message = error is ApiException
        ? errorText(context, error)
        : AppLocalizations.of(context)!.errorGeneric;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  /// Запись флага прогресса — как и сам запрос разрешений выше, тоже
  /// может провалиться (инвалидация `SharedPreferences` и т.п.), и тоже не
  /// должна запирать пользователя на этом экране: [widget.onFinished]
  /// вызывается независимо от того, удалась ли запись. Единственная цена
  /// сбоя — экран запроса разрешений может показаться повторно при
  /// следующем запуске, что несравнимо дешевле тупика.
  Future<void> _finish() async {
    try {
      await ref.read(onboardingFlagsProvider).setAskedPermissions(true);
    } catch (error, stack) {
      debugPrint(
        'PermissionsScreen: не удалось сохранить sq.onboarding.permissions: '
        '$error\n$stack',
      );
    }
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
              key: const Key('sq-permissions-allow-button'),
              label: l10n.actionAllow,
              loading: _requesting,
              onPressed: _busy ? null : _allow,
            ),
            const SizedBox(height: SqSpacing.s),
            SqButton(
              key: const Key('sq-permissions-later-button'),
              kind: SqButtonKind.secondary,
              label: l10n.actionLater,
              loading: _skipping,
              onPressed: _busy ? null : _later,
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
