/// Профиль специалиста (прототип `11-therapist-profile.png`).
///
/// Фото, «о себе», образование, число проведённых консультаций и
/// аудио-приветствие из прототипа здесь отсутствуют: в `ExpertPublicDto`
/// бэкенда их нет — это его PII-инвариант (см. комментарий в самом DTO).
/// `photoUrl` придёт эпиком E2a, остальное — вопрос к бэкенду, а не к
/// экрану; выдумывать данные профиля клиент не вправе.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/error_text.dart';
import '../../../core/route_paths.dart';
import '../../../l10n/app_localizations.dart';
import '../../funnel/data/requests_repository.dart';
import '../../funnel/state/search_controller.dart';
import '../../funnel/ui/format_sheet.dart';
import '../../booking/ui/booking_args.dart';
import '../../funnel/ui/topic_picker_sheet.dart';
import '../../payment/ui/found_screen.dart' show experienceLabel;
import '../state/catalog_controller.dart';
import '../state/expert_controller.dart';
import '../state/favorites_controller.dart';
import 'expert_card.dart';

class ExpertScreen extends ConsumerStatefulWidget {
  const ExpertScreen({super.key, required this.expertId});

  final String expertId;

  @override
  ConsumerState<ExpertScreen> createState() => _ExpertScreenState();
}

class _ExpertScreenState extends ConsumerState<ExpertScreen> {
  bool _booking = false;
  String? _error;

  /// «Записаться на время» (E6b): формат и тема нужны и здесь — запись
  /// создаётся сразу с ними, без цепочки офферов.
  Future<void> _schedule(ExpertPublic expert) async {
    final choice = await _askFormatAndTopic(expert);
    if (choice == null || !mounted) return;

    context.push(
      RoutePaths.booking(expert.id),
      extra: BookingArgs(
        expertId: expert.id,
        topicSlug: choice.topicSlug,
        format: choice.format,
      ),
    );
  }

  /// «Связаться сейчас»: мгновенная адресная заявка — она имеет смысл,
  /// только пока специалист принимает.
  Future<void> _book(ExpertPublic expert) async {
    final choice = await _askFormatAndTopic(expert);
    if (choice == null || !mounted) return;

    await _createRequest(
      topicSlug: choice.topicSlug,
      format: choice.format,
      expertId: expert.id,
    );
  }

  Future<({String topicSlug, SessionFormat format})?> _askFormatAndTopic(
    ExpertPublic expert,
  ) async {
    final format = await showFormatSheet(context);
    if (format == null || !mounted) return null;

    // Тема берётся, в порядке убывания надёжности: из фильтра каталога
    // (клиент только что искал именно по ней), из единственной
    // специализации специалиста, иначе спрашиваем. Заявка без темы
    // бэкендом не принимается.
    String? topicSlug = ref.read(catalogFiltersProvider).topicSlug ??
        (expert.topicSlugs.length == 1 ? expert.topicSlugs.single : null);
    if (topicSlug == null) {
      final topic = await showTopicPickerSheet(context);
      if (topic == null || !mounted) return null;
      topicSlug = topic.slug;
    }

    return (topicSlug: topicSlug, format: format);
  }

  Future<void> _createRequest({
    required String topicSlug,
    required SessionFormat format,
    required String? expertId,
  }) async {
    setState(() {
      _booking = true;
      _error = null;
    });
    try {
      final request = await ref
          .read(requestsRepositoryProvider)
          .create(topicSlug: topicSlug, format: format, expertId: expertId);
      if (!mounted) return;
      context.go(
        RoutePaths.search(request.id),
        extra: SearchArgs(
          requestId: request.id,
          topicSlug: topicSlug,
          format: format,
        ),
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      if (error.code == ApiErrorCode.expertUnavailable && expertId != null) {
        setState(() => _booking = false);
        await _offerAutoMatch(topicSlug: topicSlug, format: format);
        return;
      }
      setState(() => _error = errorText(context, error));
    } catch (_) {
      if (mounted) {
        setState(() => _error = AppLocalizations.of(context)!.errorGeneric);
      }
    } finally {
      // Урок 4 плана эпика: флаг занятости снимается и в аварийной ветке.
      if (mounted) setState(() => _booking = false);
    }
  }

  /// Специалист занят — предлагаем обычный автоподбор по той же теме и
  /// формату (заявка без `expertId`).
  Future<void> _offerAutoMatch({
    required String topicSlug,
    required SessionFormat format,
  }) async {
    final l10n = AppLocalizations.of(context)!;
    final accepted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l10n.expertUnavailableTitle),
        content: Text(l10n.expertUnavailableBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(l10n.actionClose),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(l10n.expertPickAutomatically),
          ),
        ],
      ),
    );
    if (accepted != true || !mounted) return;

    await _createRequest(
      topicSlug: topicSlug,
      format: format,
      expertId: null,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final provider = expertControllerProvider(widget.expertId);
    final profile = ref.watch(provider);
    final isFavorite = ref.watch(isFavoriteProvider(widget.expertId));
    final topics = ref.watch(topicsProvider).valueOrNull;

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(
        actions: [
          IconButton(
            key: const Key('sq-expert-favorite'),
            icon: Icon(
              isFavorite ? Icons.favorite : Icons.favorite_border,
              color: isFavorite ? SqColors.danger : SqColors.textSecondary,
            ),
            onPressed: profile.valueOrNull == null
                ? null
                : () => ref
                      .read(favoritesControllerProvider.notifier)
                      .toggle(profile.requireValue.expert),
          ),
        ],
      ),
      body: SafeArea(
        child: profile.when(
          loading: () => const Center(child: SqLoader()),
          error: (error, stackTrace) => Center(
            child: Padding(
              padding: const EdgeInsets.all(SqSpacing.l),
              child: SqErrorView(
                text: error is ApiException
                    ? errorText(context, error)
                    : l10n.errorGeneric,
                onRetry: () => ref.read(provider.notifier).retry(),
                retryLabel: l10n.actionRetry,
              ),
            ),
          ),
          data: (state) => ListView(
            padding: const EdgeInsets.all(SqSpacing.l),
            children: [
              _Head(expert: state.expert),
              const SizedBox(height: SqSpacing.l),
              Text(l10n.expertTopicsTitle, style: SqTypography.title),
              const SizedBox(height: SqSpacing.s),
              Wrap(
                spacing: SqSpacing.s,
                runSpacing: SqSpacing.s,
                children: [
                  for (final slug in state.expert.topicSlugs)
                    SqChip(label: topicName(topics, slug)),
                ],
              ),
              const SizedBox(height: SqSpacing.l),
              RatingDistributionView(
                distribution: state.distribution,
                ratingAvg: state.expert.ratingAvg,
                ratingCount: state.expert.ratingCount,
              ),
              const SizedBox(height: SqSpacing.l),
              Text(l10n.expertReviewsTitle, style: SqTypography.title),
              const SizedBox(height: SqSpacing.s),
              if (state.reviews.isEmpty)
                Text(
                  l10n.expertNoReviews,
                  style: SqTypography.body.copyWith(
                    color: SqColors.textSecondary,
                  ),
                ),
              for (final review in state.reviews)
                ReviewItemView(review: review),
              if (state.hasMore)
                Center(
                  child: TextButton(
                    key: const Key('sq-expert-load-more'),
                    onPressed: state.loadingMore
                        ? null
                        : () =>
                              ref.read(provider.notifier).loadMoreReviews(),
                    child: Text(l10n.expertLoadMoreReviews),
                  ),
                ),
              if (_error != null) ...[
                const SizedBox(height: SqSpacing.m),
                Text(
                  _error!,
                  key: const Key('sq-expert-error'),
                  style: SqTypography.body.copyWith(color: SqColors.danger),
                  textAlign: TextAlign.center,
                ),
              ],
              const SizedBox(height: SqSpacing.xl),
              SqButton(
                key: const Key('sq-expert-book'),
                label: l10n.bookingActionSchedule,
                onPressed: _booking ? null : () => _schedule(state.expert),
              ),
              const SizedBox(height: SqSpacing.m),
              // Мгновенная консультация имеет смысл, только пока
              // специалист принимает заявки прямо сейчас.
              SqButton(
                key: const Key('sq-expert-book-now'),
                kind: SqButtonKind.secondary,
                label: l10n.bookingActionNow,
                loading: _booking,
                onPressed:
                    _booking ||
                        state.expert.workStatus != WorkStatus.accepting
                    ? null
                    : () => _book(state.expert),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Локализованное имя темы по slug'у. Неизвестный slug показывается как
/// есть: справочник тем и специализации эксперта могут разойтись, и молча
/// терять тему профиля хуже, чем показать её техническим именем.
String topicName(List<Topic>? topics, String slug) {
  final match = topics?.where((topic) => topic.slug == slug);
  return (match == null || match.isEmpty) ? slug : match.first.name;
}

class _Head extends StatelessWidget {
  const _Head({required this.expert});

  final ExpertPublic expert;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return SqCard(
      child: Column(
        children: [
          SqAvatar(
            name: expert.displayName,
            photoUrl: expert.photoUrl,
            size: 72,
          ),
          const SizedBox(height: SqSpacing.m),
          Text(expert.displayName, style: SqTypography.h2),
          const SizedBox(height: SqSpacing.xs),
          Text(
            '${expert.city} · ${l10n.expertExperienceLabel}: '
            '${experienceLabel(l10n, expert.experience)}',
            style: SqTypography.body.copyWith(color: SqColors.textSecondary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: SqSpacing.xs),
          Text(
            l10n.expertLanguages(
              expert.languages.map((e) => e.toUpperCase()).join(' · '),
            ),
            style: SqTypography.caption.copyWith(
              color: SqColors.textSecondary,
            ),
          ),
          const SizedBox(height: SqSpacing.m),
          Text(
            l10n.expertPriceLabel,
            style: SqTypography.caption.copyWith(
              color: SqColors.textSecondary,
            ),
          ),
          Text(formatTenge(expert.priceTiyn), style: SqTypography.h2),
          // Блок «о себе» рисуется только когда текст есть: пустой
          // заголовок хуже отсутствующего.
          if (expert.about case final about?) ...[
            const SizedBox(height: SqSpacing.m),
            Text(
              about,
              key: const Key('sq-expert-about'),
              style: SqTypography.body,
              textAlign: TextAlign.center,
            ),
          ],
        ],
      ),
    );
  }
}
