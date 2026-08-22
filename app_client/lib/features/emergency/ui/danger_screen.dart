/// Экран угрозы (ответ «Да» на скрининге БП-02): прямые звонки в службы.
///
/// Платформа не заменяет экстренные службы (ТЗ §4.3) — здесь у человека
/// перед глазами только два больших номера, а подбор специалиста уходит на
/// второй план, но остаётся доступным.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../core/url_launcher_port.dart';
import '../../../l10n/app_localizations.dart';
import '../state/emergency_controller.dart';
import 'screening_screen.dart';

class DangerScreen extends ConsumerStatefulWidget {
  const DangerScreen({super.key});

  @override
  ConsumerState<DangerScreen> createState() => _DangerScreenState();
}

class _DangerScreenState extends ConsumerState<DangerScreen> {
  String? _error;

  void _call(String number) =>
      ref.read(urlLauncherPortProvider).launch('tel:$number');

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final busy = ref.watch(emergencyControllerProvider).isLoading;

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(SqSpacing.l),
          children: [
            Text(
              l10n.emergencyDangerTitle,
              style: SqTypography.h1,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: SqSpacing.m),
            Text(
              l10n.emergencyDangerBody,
              style: SqTypography.body.copyWith(color: SqColors.textSecondary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: SqSpacing.xl),
            SqButton(
              key: const Key('sq-danger-call-102'),
              kind: SqButtonKind.danger,
              label: l10n.emergencyCallPolice,
              onPressed: () => _call('102'),
            ),
            const SizedBox(height: SqSpacing.m),
            SqButton(
              key: const Key('sq-danger-call-103'),
              kind: SqButtonKind.danger,
              label: l10n.emergencyCallAmbulance,
              onPressed: () => _call('103'),
            ),
            const SizedBox(height: SqSpacing.xxl),
            SqButton(
              key: const Key('sq-danger-continue'),
              kind: SqButtonKind.secondary,
              label: l10n.emergencyContinueSearch,
              loading: busy,
              onPressed: busy
                  ? null
                  : () => startEmergencySearch(
                      context: context,
                      ref: ref,
                      format: emergencyDefaultFormat,
                      onError: (message) => setState(() => _error = message),
                    ),
            ),
            if (_error != null) ...[
              const SizedBox(height: SqSpacing.m),
              Text(
                _error!,
                key: const Key('sq-danger-error'),
                style: SqTypography.body.copyWith(color: SqColors.danger),
                textAlign: TextAlign.center,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
