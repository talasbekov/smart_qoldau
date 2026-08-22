/// Экран эскалации Р-16: заявку на обратный звонок бэкенд уже создал сам
/// (статус заявки `CALLBACK_REQUESTED`), клиенту остаётся дождаться звонка
/// — а пока перед ним номера, по которым можно позвонить прямо сейчас.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/route_paths.dart';
import '../../../core/url_launcher_port.dart';
import '../../../l10n/app_localizations.dart';

/// Фолбэк, если бэкенд прислал событие без номеров: телефон доверия,
/// скорая помощь и единая служба спасения (Р-16). Экран без единого номера
/// был бы тупиком именно там, где тупик недопустим.
const fallbackHotlines = ['150', '103', '112'];

class HotlinesScreen extends ConsumerWidget {
  const HotlinesScreen({super.key, this.hotlines});

  /// Номера из события `request.updated`. `null` или пустой список —
  /// используется [fallbackHotlines].
  final List<String>? hotlines;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final numbers = (hotlines == null || hotlines!.isEmpty)
        ? fallbackHotlines
        : hotlines!;

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(SqSpacing.l),
          children: [
            Text(
              l10n.hotlinesTitle,
              style: SqTypography.h1,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: SqSpacing.m),
            Text(
              l10n.hotlinesBody,
              style: SqTypography.body.copyWith(color: SqColors.textSecondary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: SqSpacing.xl),
            for (final number in numbers) ...[
              SqCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(number, style: SqTypography.h2),
                    if (_hotlineName(l10n, number) case final name?) ...[
                      const SizedBox(height: SqSpacing.xs),
                      Text(
                        name,
                        style: SqTypography.body.copyWith(
                          color: SqColors.textSecondary,
                        ),
                      ),
                    ],
                    const SizedBox(height: SqSpacing.m),
                    SqButton(
                      key: Key('sq-hotline-$number'),
                      kind: SqButtonKind.danger,
                      label: l10n.hotlineCall(number),
                      onPressed: () =>
                          ref.read(urlLauncherPortProvider).launch(
                            'tel:$number',
                          ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: SqSpacing.m),
            ],
            const SizedBox(height: SqSpacing.l),
            SqButton(
              key: const Key('sq-hotlines-home'),
              kind: SqButtonKind.secondary,
              label: l10n.actionGoHome,
              onPressed: () => context.go(RoutePaths.home),
            ),
          ],
        ),
      ),
    );
  }
}

/// Название известного номера. `null` — номер прислал бэкенд, и что это за
/// служба, клиент знает лучше нас: показываем сам номер без подписи, а не
/// выдумываем её.
String? _hotlineName(AppLocalizations l10n, String number) => switch (number) {
  '150' => l10n.hotlineName150,
  '103' => l10n.hotlineName103,
  '112' => l10n.hotlineName112,
  _ => null,
};
