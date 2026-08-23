/// Экран оценки консультации (прототип `15-rating.png`): звёзды, публичный
/// и приватный отзывы, повторная запись к тому же специалисту.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/error_text.dart';
import '../../../core/route_paths.dart';
import '../../../l10n/app_localizations.dart';
import '../../consultations/data/consultations_repository.dart';
import '../../funnel/state/search_controller.dart';
import '../../funnel/ui/topic_picker_sheet.dart';
import '../state/review_controller.dart';

class ReviewScreen extends ConsumerStatefulWidget {
  const ReviewScreen({super.key, required this.consultationId});

  final String consultationId;

  @override
  ConsumerState<ReviewScreen> createState() => _ReviewScreenState();
}

class _ReviewScreenState extends ConsumerState<ReviewScreen> {
  final _public = TextEditingController();
  final _private = TextEditingController();

  @override
  void dispose() {
    _public.dispose();
    _private.dispose();
    super.dispose();
  }

  ReviewController get _notifier =>
      ref.read(reviewControllerProvider(widget.consultationId).notifier);

  Future<void> _submit() async {
    await _notifier.submit();
    if (!mounted) return;
    final phase = ref.read(reviewControllerProvider(widget.consultationId)).phase;
    if (phase == ReviewPhase.sent) context.go(RoutePaths.home);
  }

  Future<void> _skip() async {
    await _notifier.skip();
    if (mounted) context.go(RoutePaths.home);
  }

  /// «Продолжить с тем же психологом». Тему спрашиваем: в
  /// `ConsultationClientDto` её нет, а угадывать по специализациям
  /// специалиста значило бы записать человека не с тем запросом. Формат
  /// берём из самой консультации — он в DTO есть.
  Future<void> _continueWithExpert(ClientConsultation consultation) async {
    final topic = await showTopicPickerSheet(context);
    if (topic == null || !mounted) return;

    final request = await _notifier.continueWithExpert(
      expertId: consultation.expert.id,
      topicSlug: topic.slug,
      format: consultation.format,
    );
    if (request == null || !mounted) return;

    context.go(
      RoutePaths.search(request.id),
      extra: SearchArgs(
        requestId: request.id,
        topicSlug: topic.slug,
        format: consultation.format,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final consultation = ref.watch(consultationProvider(widget.consultationId));
    final review = ref.watch(reviewControllerProvider(widget.consultationId));

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(
        actions: [
          if (review.phase != ReviewPhase.alreadyExists)
            TextButton(
              key: const Key('sq-review-skip'),
              onPressed: _skip,
              child: Text(l10n.reviewSkip),
            ),
        ],
      ),
      body: SafeArea(
        child: consultation.when(
          loading: () => const Center(child: SqLoader()),
          error: (error, stackTrace) => Center(
            child: Padding(
              padding: const EdgeInsets.all(SqSpacing.l),
              child: SqErrorView(
                text: error is ApiException
                    ? errorText(context, error)
                    : l10n.errorGeneric,
                onRetry: () =>
                    ref.invalidate(consultationProvider(widget.consultationId)),
                retryLabel: l10n.actionRetry,
              ),
            ),
          ),
          data: (data) => review.phase == ReviewPhase.alreadyExists
              ? _AlreadyExists(onDone: () => context.go(RoutePaths.home))
              : _Form(
                  consultation: data,
                  review: review,
                  publicController: _public,
                  privateController: _private,
                  onRating: _notifier.setRating,
                  onToggleTag: _notifier.toggleTag,
                  onPublicChanged: _notifier.setPublicText,
                  onPrivateChanged: _notifier.setPrivateText,
                  onSubmit: _submit,
                  onContinueWithExpert: () => _continueWithExpert(data),
                ),
        ),
      ),
    );
  }
}

class _Form extends StatelessWidget {
  const _Form({
    required this.consultation,
    required this.review,
    required this.publicController,
    required this.privateController,
    required this.onRating,
    required this.onToggleTag,
    required this.onPublicChanged,
    required this.onPrivateChanged,
    required this.onSubmit,
    required this.onContinueWithExpert,
  });

  final ClientConsultation consultation;
  final ReviewState review;
  final TextEditingController publicController;
  final TextEditingController privateController;
  final ValueChanged<int> onRating;
  final ValueChanged<String> onToggleTag;
  final ValueChanged<String> onPublicChanged;
  final ValueChanged<String> onPrivateChanged;
  final VoidCallback onSubmit;
  final VoidCallback onContinueWithExpert;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return ListView(
      padding: const EdgeInsets.all(SqSpacing.l),
      children: [
        Text(
          l10n.reviewTitle,
          style: SqTypography.h1,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: SqSpacing.l),
        SqCard(
          child: Row(
            children: [
              SqAvatar(name: consultation.expert.displayName, size: 44),
              const SizedBox(width: SqSpacing.m),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      consultation.expert.displayName,
                      style: SqTypography.title,
                    ),
                    Text(
                      l10n.paymentDuration(consultation.plannedDurationMin),
                      style: SqTypography.caption.copyWith(
                        color: SqColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: SqSpacing.l),
        Text(
          l10n.reviewRatingQuestion,
          style: SqTypography.title,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: SqSpacing.m),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (var star = 1; star <= 5; star++)
              IconButton(
                key: Key('sq-review-star-$star'),
                onPressed: () => onRating(star),
                icon: Icon(
                  star <= review.rating ? Icons.star : Icons.star_border,
                  color: star <= review.rating
                      ? SqColors.accent
                      : SqColors.textTertiary,
                  size: 36,
                ),
              ),
          ],
        ),
        if (review.rating > 0) ...[
          const SizedBox(height: SqSpacing.xs),
          Text(
            _ratingLabel(l10n, review.rating),
            style: SqTypography.title.copyWith(color: SqColors.primary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: SqSpacing.m),
          Text(
            l10n.reviewTagsHint,
            style: SqTypography.caption.copyWith(
              color: SqColors.textSecondary,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: SqSpacing.xs),
          Wrap(
            alignment: WrapAlignment.center,
            spacing: SqSpacing.xs,
            runSpacing: SqSpacing.xs,
            children: [
              for (final code in reviewTagsFor(review.rating))
                GestureDetector(
                  key: Key('sq-review-tag-$code'),
                  onTap: () => onToggleTag(code),
                  child: SqChip(
                    label: _tagLabel(l10n, code),
                    selected: review.tags.contains(code),
                  ),
                ),
            ],
          ),
        ],
        const SizedBox(height: SqSpacing.l),
        SqTextField(
          key: const Key('sq-review-public'),
          controller: publicController,
          label: l10n.reviewPublicLabel,
          hint: l10n.reviewPublicHint,
          onChanged: onPublicChanged,
        ),
        const SizedBox(height: SqSpacing.m),
        SqTextField(
          key: const Key('sq-review-private'),
          controller: privateController,
          label: l10n.reviewPrivateLabel,
          onChanged: onPrivateChanged,
        ),
        const SizedBox(height: SqSpacing.xs),
        Text(
          l10n.reviewPrivateHint,
          style: SqTypography.caption.copyWith(color: SqColors.textSecondary),
        ),
        if (review.errorCode != null) ...[
          const SizedBox(height: SqSpacing.m),
          Text(
            errorText(context, ApiException(review.errorCode!, '', 0)),
            key: const Key('sq-review-error'),
            style: SqTypography.body.copyWith(color: SqColors.danger),
            textAlign: TextAlign.center,
          ),
        ],
        const SizedBox(height: SqSpacing.xl),
        SqButton(
          key: const Key('sq-review-submit'),
          label: l10n.reviewSend,
          loading: review.phase == ReviewPhase.sending,
          onPressed: onSubmit,
        ),
        const SizedBox(height: SqSpacing.m),
        SqButton(
          key: const Key('sq-review-continue-expert'),
          kind: SqButtonKind.secondary,
          label: l10n.reviewContinueSameExpert,
          onPressed: onContinueWithExpert,
        ),
      ],
    );
  }

  /// Подписи тегов живут в локализации, а не в коде и не в БД: иначе
  /// казахская локаль получила бы русский текст.
  String _tagLabel(AppLocalizations l10n, String code) => switch (code) {
    'not_helpful' => l10n.reviewTagNotHelpful,
    'long_wait' => l10n.reviewTagLongWait,
    'bad_connection' => l10n.reviewTagBadConnection,
    'little_use' => l10n.reviewTagLittleUse,
    'did_not_understand' => l10n.reviewTagDidNotUnderstand,
    'technical_issues' => l10n.reviewTagTechnicalIssues,
    'average' => l10n.reviewTagAverage,
    'could_be_better' => l10n.reviewTagCouldBeBetter,
    'standard' => l10n.reviewTagStandard,
    'attentive' => l10n.reviewTagAttentive,
    'helped_figure_out' => l10n.reviewTagHelpedFigureOut,
    'professional' => l10n.reviewTagProfessional,
    _ => l10n.reviewTagExceededExpectations,
  };

  String _ratingLabel(AppLocalizations l10n, int rating) => switch (rating) {
    1 => l10n.reviewRating1,
    2 => l10n.reviewRating2,
    3 => l10n.reviewRating3,
    4 => l10n.reviewRating4,
    _ => l10n.reviewRating5,
  };
}

class _AlreadyExists extends StatelessWidget {
  const _AlreadyExists({required this.onDone});

  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(SqSpacing.l),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SqEmptyState(
              icon: Icons.reviews_outlined,
              title: l10n.reviewExistsTitle,
            ),
            const SizedBox(height: SqSpacing.xl),
            SqButton(
              key: const Key('sq-review-done'),
              label: l10n.actionDone,
              onPressed: onDone,
            ),
          ],
        ),
      ),
    );
  }
}
