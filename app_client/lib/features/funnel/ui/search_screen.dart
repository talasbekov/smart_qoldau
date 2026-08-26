/// Экран поиска специалиста (прототип `09-search.png`): прогресс подбора,
/// счётчик «Сейчас онлайн: N», прошедшее время и отмена поиска.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/error_text.dart';
import '../../../core/route_paths.dart';
import '../../../core/url_launcher_port.dart';
import '../../../l10n/app_localizations.dart';
import '../state/funnel_controller.dart';
import '../state/search_controller.dart';
import 'no_experts_screen.dart';

/// `mm:ss` прошедшего времени поиска.
///
/// Прототип рисует ОБРАТНЫЙ отсчёт («Осталось примерно 1:56»), но обещать
/// конкретное время подбора нечем: бэкенд не сообщает ни оценки, ни
/// дедлайна (таймеры офферов 45/20 с — внутренние, число попыток заранее
/// неизвестно). Показываем честное прошедшее время, как и требует бриф
/// задачи; расхождение с прототипом — сознательное.
String formatElapsed(int totalSeconds) {
  final minutes = (totalSeconds ~/ 60).toString().padLeft(2, '0');
  final seconds = (totalSeconds % 60).toString().padLeft(2, '0');
  return '$minutes:$seconds';
}

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key, required this.args});

  final SearchArgs args;

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  bool _cancelling = false;
  String? _error;

  Future<void> _cancel() async {
    setState(() {
      _cancelling = true;
      _error = null;
    });
    try {
      await ref.read(searchControllerProvider(widget.args).notifier).cancel();
      // Переход на главную делает слушатель статуса: заявка отменена
      // тогда, когда это подтвердил бэкенд, а не когда нажата кнопка.
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = errorText(context, error));
    } catch (_) {
      if (mounted) {
        setState(() => _error = AppLocalizations.of(context)!.errorGeneric);
      }
    } finally {
      // Именно `finally` (урок 4 плана эпика): иначе сбой сети оставил бы
      // единственную кнопку экрана в вечном спиннере.
      if (mounted) setState(() => _cancelling = false);
    }
  }

  /// «Попробовать снова» на экране «нет свободных специалистов»: создаёт
  /// НОВУЮ заявку с теми же темой и форматом и переоткрывает поиск по ней.
  Future<void> _retrySearch() async {
    final topicSlug = widget.args.topicSlug;
    final format = widget.args.format;
    if (topicSlug == null || format == null) return;

    setState(() => _error = null);
    try {
      final request = await ref
          .read(funnelControllerProvider.notifier)
          .create(
            topicSlug: topicSlug,
            format: format,
            isEmergency: widget.args.isEmergency,
          );
      if (!mounted) return;
      context.go(
        RoutePaths.search(request.id),
        extra: SearchArgs(
          requestId: request.id,
          topicSlug: topicSlug,
          format: format,
          isEmergency: widget.args.isEmergency,
        ),
      );
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = errorText(context, error));
    } catch (_) {
      if (mounted) {
        setState(() => _error = AppLocalizations.of(context)!.errorGeneric);
      }
    }
  }

  /// Терминальные переходы. Живут в слушателе, а не в `build`: навигация —
  /// побочный эффект изменения статуса, а не результат отрисовки.
  void _onStatusChanged(SearchState? previous, SearchState next) {
    switch (next.status) {
      case RequestStatus.matched:
        context.go(RoutePaths.found(widget.args.requestId));
      case RequestStatus.cancelled:
        context.go(RoutePaths.home);
      case RequestStatus.callbackRequested:
        // Номера едут с собой: они пришли в событии заявки, отдельного
        // эндпоинта для них у бэкенда нет.
        context.go(RoutePaths.emergencyHotlines, extra: next.hotlines);
      case RequestStatus.noExperts:
      case RequestStatus.searching:
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final provider = searchControllerProvider(widget.args);

    ref.listen(provider, (previous, next) {
      final state = next.valueOrNull;
      if (state == null) return;
      _onStatusChanged(previous?.valueOrNull, state);
    });

    final asyncState = ref.watch(provider);
    final creating = ref.watch(funnelControllerProvider).isLoading;

    return Scaffold(
      backgroundColor: SqColors.background,
      body: SafeArea(
        child: asyncState.when(
          loading: () => const Center(child: SqLoader()),
          error: (error, stackTrace) => Center(
            child: Padding(
              padding: const EdgeInsets.all(SqSpacing.l),
              child: SqErrorView(
                text: error is ApiException
                    ? errorText(context, error)
                    : l10n.errorGeneric,
                onRetry: () => ref.invalidate(provider),
                retryLabel: l10n.actionRetry,
              ),
            ),
          ),
          data: (state) => switch (state.status) {
            RequestStatus.noExperts => NoExpertsView(
              busy: creating,
              onTryAgain: widget.args.hasCountFilter ? _retrySearch : null,
              onGoHome: () => context.go(RoutePaths.home),
            ),
            // matched / cancelled / callbackRequested — экран уже уезжает
            // (см. `_onStatusChanged`), показывать содержимое поиска в этот
            // кадр незачем.
            RequestStatus.matched ||
            RequestStatus.cancelled ||
            RequestStatus.callbackRequested => const Center(child: SqLoader()),
            RequestStatus.searching => _SearchingContent(
              state: state,
              error: _error,
              cancelling: _cancelling,
              onCancel: _cancelling ? null : _cancel,
              isEmergency: widget.args.isEmergency,
            ),
          },
        ),
      ),
    );
  }
}

class _SearchingContent extends ConsumerWidget {
  const _SearchingContent({
    required this.state,
    required this.error,
    required this.cancelling,
    required this.onCancel,
    required this.isEmergency,
  });

  final SearchState state;
  final String? error;
  final bool cancelling;
  final VoidCallback? onCancel;

  /// Экстренный вариант экрана (БП-02, прототип `16-emergency.png`):
  /// красный акцент, «Приоритетный поиск» и ПОСТОЯННО видимая кнопка
  /// вызова служб — она не входит в прокручиваемое содержимое.
  final bool isEmergency;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final onlineCount = state.onlineCount;
    final accent = isEmergency ? SqColors.danger : SqColors.primary;

    return Column(
      children: [
        Expanded(child: _list(context, l10n, onlineCount, accent)),
        if (isEmergency)
          Padding(
            padding: const EdgeInsets.fromLTRB(
              SqSpacing.l,
              0,
              SqSpacing.l,
              SqSpacing.l,
            ),
            child: SqButton(
              key: const Key('sq-search-call-services'),
              kind: SqButtonKind.danger,
              label: l10n.emergencyCallServices,
              // 103 — скорая помощь; 112 в подписи оставлен как второй
              // известный номер, но набирается один: диалог выбора номера
              // посреди кризиса — лишний шаг.
              onPressed: () =>
                  ref.read(urlLauncherPortProvider).launch('tel:103'),
            ),
          ),
      ],
    );
  }

  Widget _list(
    BuildContext context,
    AppLocalizations l10n,
    int? onlineCount,
    Color accent,
  ) {
    return ListView(
      padding: const EdgeInsets.all(SqSpacing.l),
      children: [
        const SizedBox(height: SqSpacing.xl),
        if (isEmergency) ...[
          Center(
            child: SqChip(label: l10n.emergencySearchBadge, selected: true),
          ),
          const SizedBox(height: SqSpacing.m),
        ],
        Text(
          isEmergency ? l10n.emergencySearchTitle : l10n.searchTitle,
          style: SqTypography.h1,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: SqSpacing.s),
        Text(
          isEmergency ? l10n.emergencySearchSubtitle : l10n.searchSubtitle,
          style: SqTypography.body.copyWith(color: SqColors.textSecondary),
          textAlign: TextAlign.center,
        ),
        if (!isEmergency) ...[
          const SizedBox(height: SqSpacing.xs),
          Text(
            l10n.searchHint,
            style: SqTypography.caption.copyWith(color: SqColors.textTertiary),
            textAlign: TextAlign.center,
          ),
        ],
        const SizedBox(height: SqSpacing.xl),
        const Center(child: SqLoader()),
        const SizedBox(height: SqSpacing.xl),
        Text(
          l10n.searchElapsedLabel,
          style: SqTypography.caption.copyWith(color: SqColors.textSecondary),
          textAlign: TextAlign.center,
        ),
        Text(
          formatElapsed(state.elapsedSec),
          key: const Key('sq-search-elapsed'),
          style: SqTypography.h1.copyWith(color: accent),
          textAlign: TextAlign.center,
        ),
        if (onlineCount != null) ...[
          const SizedBox(height: SqSpacing.l),
          SqCard(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.circle, size: 10, color: accent),
                const SizedBox(width: SqSpacing.s),
                Flexible(
                  child: Text(
                    l10n.searchOnlineCount(onlineCount),
                    key: const Key('sq-search-online-count'),
                    style: SqTypography.title,
                  ),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: SqSpacing.l),
        Text(
          isEmergency
              ? l10n.emergencySearchEncouragement
              : l10n.searchEncouragement,
          style: SqTypography.body.copyWith(color: SqColors.textSecondary),
          textAlign: TextAlign.center,
        ),
        if (error != null) ...[
          const SizedBox(height: SqSpacing.m),
          Text(
            error!,
            key: const Key('sq-search-error'),
            style: SqTypography.body.copyWith(color: SqColors.danger),
            textAlign: TextAlign.center,
          ),
        ],
        const SizedBox(height: SqSpacing.xl),
        SqButton(
          key: const Key('sq-search-cancel'),
          label: l10n.searchCancel,
          kind: SqButtonKind.secondary,
          loading: cancelling,
          onPressed: onCancel,
        ),
      ],
    );
  }
}
