/// Экран темы (прототип `08-topic.png`): подтверждение выбранной темы,
/// выбор формата общения и создание заявки на подбор специалиста.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/analytics_provider.dart';
import '../../../core/error_text.dart';
import '../../../core/route_paths.dart';
import '../../consultations/data/consultations_repository.dart';
import '../../../l10n/app_localizations.dart';
import '../state/funnel_controller.dart';
import '../state/search_controller.dart';
import 'format_sheet.dart';

class TopicScreen extends ConsumerStatefulWidget {
  const TopicScreen({super.key, required this.slug, this.topicName});

  /// `slug` темы из `/topic?slug=<slug>`. `null` — только при обращении по
  /// некорректной ссылке: тема обязательна, без неё заявку не создать.
  final String? slug;

  /// Название темы на языке интерфейса. Приходит через `extra` роутера от
  /// главного экрана, у которого справочник тем уже загружен, — отдельного
  /// запроса ради одного названия не нужно. `null` при переходе по прямой
  /// ссылке: тогда показываем сам `slug`.
  final String? topicName;

  @override
  ConsumerState<TopicScreen> createState() => _TopicScreenState();
}

class _TopicScreenState extends ConsumerState<TopicScreen> {
  SessionFormat? _format;
  String? _error;

  @override
  void initState() {
    super.initState();
    // Тема выбрана — экран темы открыт именно с ней (ТЗ §10).
    final slug = widget.slug;
    if (slug != null) {
      ref.read(analyticsProvider).track(TopicSelected(topicSlug: slug));
    }
  }

  Future<void> _pickFormat() async {
    final format = await showFormatSheet(context);
    // Закрытие шторки без выбора — нормальный исход: ничего не меняем.
    if (format == null || !mounted) return;
    ref.read(analyticsProvider).track(
      FormatSelected(format: format.wireValue),
    );
    setState(() {
      _format = format;
      _error = null;
    });
  }

  Future<void> _submit() async {
    final slug = widget.slug;
    final format = _format;
    if (slug == null || format == null) return;

    setState(() => _error = null);
    try {
      final request = await ref
          .read(funnelControllerProvider.notifier)
          .create(topicSlug: slug, format: format);
      if (!mounted) return;
      context.go(
        RoutePaths.search(request.id),
        extra: SearchArgs(
          requestId: request.id,
          topicSlug: slug,
          format: format,
        ),
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      if (error.code == ApiErrorCode.activeRequestExists) {
        await _showActiveRequestDialog();
        return;
      }
      setState(() => _error = errorText(context, error));
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = AppLocalizations.of(context)!.errorGeneric);
    }
  }

  /// Диалог по `ACTIVE_REQUEST_EXISTS` (409).
  ///
  /// Если у клиента уже есть АКТИВНАЯ консультация — предлагаем перейти в
  /// неё. Если её нет (заявка ещё ищет специалиста), кнопки не будет:
  /// эндпоинта «моя активная заявка» бэкенд не даёт, а угадывать её
  /// идентификатор неоткуда — диалог остаётся объяснением.
  Future<void> _showActiveRequestDialog() async {
    final l10n = AppLocalizations.of(context)!;

    ClientConsultation? active;
    try {
      final list = await ref
          .read(consultationsRepositoryProvider)
          .list(status: ConsultationStatus.active, take: 1);
      active = list.isEmpty ? null : list.first;
    } catch (_) {
      // Не смогли узнать про активную консультацию — показываем диалог без
      // перехода, он всё равно объясняет причину отказа.
      active = null;
    }
    if (!mounted) return;

    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l10n.funnelActiveRequestTitle),
        content: Text(l10n.funnelActiveRequestBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: Text(l10n.actionClose),
          ),
          if (active != null)
            TextButton(
              onPressed: () {
                Navigator.of(dialogContext).pop();
                context.go(RoutePaths.session(active!.id));
              },
              child: Text(l10n.funnelActiveRequestGoTo),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final slug = widget.slug;
    final busy = ref.watch(funnelControllerProvider).isLoading;

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(),
      body: SafeArea(
        child: slug == null
            ? _MissingTopic(l10n: l10n)
            : ListView(
                padding: const EdgeInsets.all(SqSpacing.l),
                children: [
                  Text(l10n.topicTitle, style: SqTypography.h1),
                  const SizedBox(height: SqSpacing.s),
                  Text(
                    l10n.topicSubtitle,
                    style: SqTypography.body.copyWith(
                      color: SqColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: SqSpacing.l),
                  SqCard(
                    child: Row(
                      children: [
                        const Icon(
                          Icons.psychology_alt_outlined,
                          color: SqColors.primary,
                        ),
                        const SizedBox(width: SqSpacing.m),
                        Expanded(
                          child: Text(
                            widget.topicName ?? slug,
                            style: SqTypography.title,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: SqSpacing.l),
                  InkWell(
                    key: const Key('sq-topic-format-picker'),
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
                                  l10n.topicFormatLabel,
                                  style: SqTypography.title,
                                ),
                                const SizedBox(height: SqSpacing.xs),
                                Text(
                                  _format == null
                                      ? l10n.topicFormatNotChosen
                                      : formatLabel(l10n, _format!),
                                  style: SqTypography.body.copyWith(
                                    color: _format == null
                                        ? SqColors.textSecondary
                                        : SqColors.primary,
                                  ),
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
                  if (_error != null) ...[
                    const SizedBox(height: SqSpacing.m),
                    Text(
                      _error!,
                      key: const Key('sq-topic-error'),
                      style: SqTypography.body.copyWith(color: SqColors.danger),
                      textAlign: TextAlign.center,
                    ),
                  ],
                  const SizedBox(height: SqSpacing.xl),
                  SqButton(
                    key: const Key('sq-topic-continue'),
                    label: l10n.actionContinue,
                    loading: busy,
                    // Пока формат не выбран, кнопка неактивна — это
                    // единственное недостающее условие, и объяснять его
                    // текстом ошибки после тапа было бы хуже, чем показать
                    // сразу.
                    onPressed: _format == null || busy ? null : _submit,
                  ),
                ],
              ),
      ),
    );
  }
}

/// `/topic` без `slug` — некорректная ссылка: тема обязательна для заявки.
class _MissingTopic extends StatelessWidget {
  const _MissingTopic({required this.l10n});

  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(SqSpacing.l),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SqEmptyState(
            icon: Icons.error_outline,
            title: l10n.errorGeneric,
            subtitle: l10n.homeTopicsSubtitle,
          ),
          const SizedBox(height: SqSpacing.l),
          SqButton(
            label: l10n.actionGoHome,
            kind: SqButtonKind.secondary,
            onPressed: () => context.go(RoutePaths.home),
          ),
        ],
      ),
    ),
  );
}
