/// Скрининг экстренного сценария (БП-02, шаг 2): единственный вопрос —
/// угрожает ли опасность прямо сейчас.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/error_text.dart';
import '../../../core/route_paths.dart';
import '../../../l10n/app_localizations.dart';
import '../../funnel/state/search_controller.dart';
import '../../funnel/ui/format_sheet.dart';
import '../state/emergency_controller.dart';

class ScreeningScreen extends ConsumerStatefulWidget {
  const ScreeningScreen({super.key});

  @override
  ConsumerState<ScreeningScreen> createState() => _ScreeningScreenState();
}

class _ScreeningScreenState extends ConsumerState<ScreeningScreen> {
  SessionFormat _format = emergencyDefaultFormat;
  String? _error;

  Future<void> _pickFormat() async {
    final format = await showFormatSheet(context);
    if (format == null || !mounted) return;
    setState(() => _format = format);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final busy = ref.watch(emergencyControllerProvider).isLoading;

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(title: Text(l10n.homeEmergencyCta)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(SqSpacing.l),
          children: [
            const SizedBox(height: SqSpacing.l),
            Text(
              l10n.emergencyScreeningTitle,
              style: SqTypography.h1,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: SqSpacing.m),
            Text(
              l10n.emergencyScreeningBody,
              style: SqTypography.body.copyWith(color: SqColors.textSecondary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: SqSpacing.xxl),
            SqButton(
              key: const Key('sq-emergency-yes'),
              kind: SqButtonKind.danger,
              label: l10n.actionYes,
              onPressed: busy
                  ? null
                  : () => context.push(RoutePaths.emergencyDanger),
            ),
            const SizedBox(height: SqSpacing.m),
            SqButton(
              key: const Key('sq-emergency-no'),
              label: l10n.actionNo,
              loading: busy,
              onPressed: busy
                  ? null
                  : () => startEmergencySearch(
                      context: context,
                      ref: ref,
                      format: _format,
                      onError: (message) => setState(() => _error = message),
                    ),
            ),
            if (_error != null) ...[
              const SizedBox(height: SqSpacing.m),
              Text(
                _error!,
                key: const Key('sq-emergency-error'),
                style: SqTypography.body.copyWith(color: SqColors.danger),
                textAlign: TextAlign.center,
              ),
            ],
            const SizedBox(height: SqSpacing.xl),
            InkWell(
              key: const Key('sq-emergency-format-picker'),
              onTap: busy ? null : _pickFormat,
              borderRadius: BorderRadius.circular(SqRadius.m),
              child: SqCard(
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            l10n.emergencyScreeningFormatHint,
                            style: SqTypography.caption.copyWith(
                              color: SqColors.textSecondary,
                            ),
                          ),
                          const SizedBox(height: SqSpacing.xs),
                          Text(
                            formatLabel(l10n, _format),
                            style: SqTypography.title,
                          ),
                        ],
                      ),
                    ),
                    const Icon(
                      Icons.chevron_right,
                      color: SqColors.textSecondary,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: SqSpacing.l),
            SqEmergencyDisclaimer(disclaimerText: l10n.emergencyDisclaimerText),
          ],
        ),
      ),
    );
  }
}

/// Создаёт экстренную заявку и уводит на приоритетный поиск. Общая для
/// скрининга и экрана угрозы («Мне не угрожает опасность, продолжить
/// подбор» делает ровно то же самое, что ответ «Нет»).
Future<void> startEmergencySearch({
  required BuildContext context,
  required WidgetRef ref,
  required SessionFormat format,
  required void Function(String message) onError,
}) async {
  try {
    final request = await ref
        .read(emergencyControllerProvider.notifier)
        .start(format: format);
    // `null` — повторный тап поверх уже идущего создания: делать нечего.
    if (request == null || !context.mounted) return;
    context.go(
      RoutePaths.search(request.id),
      extra: SearchArgs(
        requestId: request.id,
        topicSlug: emergencyTopicSlug,
        format: format,
        isEmergency: true,
      ),
    );
  } on ApiException catch (error) {
    if (context.mounted) onError(errorText(context, error));
  } catch (_) {
    if (context.mounted) {
      onError(AppLocalizations.of(context)!.errorGeneric);
    }
  }
}
