/// Шаг 2/2 анкеты онбординга: множественный выбор тем консультаций.
///
/// `topicsProvider` здесь — свой (а не импорт из `app_client`, монорепо не
/// допускает зависимостей между приложениями): справочник тем один и тот
/// же на бэкенде (`GET /topics`, `SqApiExperts.topics`), но у
/// `app_expert` нет `LocaleController`, которым пользуется версия из
/// `app_client/lib/features/funnel/ui/topic_picker_sheet.dart`, поэтому
/// провайдер здесь читает `SqApi.topics()` без параметра `locale` (сервер
/// сам решает язык по умолчанию).
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/route_paths.dart';
import '../state/onboarding_controller.dart';

final topicsProvider = FutureProvider.autoDispose<List<Topic>>(
  (ref) => ref.read(sqApiProvider).topics(),
);

class TopicsStepScreen extends ConsumerStatefulWidget {
  const TopicsStepScreen({super.key, required this.draft});

  /// Черновик шага 1, собранный `ProfileStepScreen`.
  final ProfileDraft draft;

  @override
  ConsumerState<TopicsStepScreen> createState() => _TopicsStepScreenState();
}

class _TopicsStepScreenState extends ConsumerState<TopicsStepScreen> {
  final Set<String> _selectedSlugs = {};
  bool _submitting = false;
  String? _errorText;

  Future<void> _submit() async {
    if (_selectedSlugs.isEmpty || _submitting) return;
    setState(() {
      _submitting = true;
      _errorText = null;
    });
    try {
      await ref
          .read(onboardingControllerProvider.notifier)
          .submit(
            displayName: widget.draft.displayName,
            city: widget.draft.city,
            experience: widget.draft.experience,
            education: widget.draft.education,
            priceTiyn: widget.draft.priceTiyn,
            languages: widget.draft.languages,
            formats: widget.draft.formats,
            topicSlugs: _selectedSlugs.toList(),
          );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _errorText = e.message;
        _submitting = false;
      });
      return;
    }
    if (!mounted) return;
    setState(() => _submitting = false);
    // Сразу после отправки анкеты профиль ещё DRAFT — ведём на экран
    // статуса верификации (задача 6 эпика E7), а не на главный (задача 10):
    // приём заявок всё равно недоступен, пока не придёт VERIFIED.
    context.go(RoutePaths.verificationStatus);
  }

  @override
  Widget build(BuildContext context) {
    final topics = ref.watch(topicsProvider);

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(title: const Text('Анкета специалиста — шаг 2 из 2')),
      body: SafeArea(
        child: topics.when(
          loading: () => const Center(child: SqLoader()),
          error: (error, stackTrace) => SqErrorView(
            text: error is ApiException ? error.message : 'Ошибка загрузки',
            onRetry: () => ref.invalidate(topicsProvider),
            retryLabel: 'Повторить',
          ),
          data: (list) => Padding(
            padding: const EdgeInsets.all(SqSpacing.l),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Выберите темы консультаций, с которыми вы работаете',
                  style: SqTypography.body.copyWith(
                    color: SqColors.textSecondary,
                  ),
                ),
                const SizedBox(height: SqSpacing.m),
                Expanded(
                  child: ListView(
                    children: [
                      Wrap(
                        spacing: SqSpacing.s,
                        runSpacing: SqSpacing.s,
                        children: [
                          for (final topic in list)
                            GestureDetector(
                              key: Key('sq-onboarding-topic-${topic.slug}'),
                              onTap: () => setState(() {
                                if (!_selectedSlugs.add(topic.slug)) {
                                  _selectedSlugs.remove(topic.slug);
                                }
                              }),
                              child: SqChip(
                                label: topic.name,
                                selected: _selectedSlugs.contains(topic.slug),
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
                if (_errorText != null) ...[
                  Text(
                    _errorText!,
                    textAlign: TextAlign.center,
                    style: SqTypography.caption.copyWith(
                      color: SqColors.danger,
                    ),
                  ),
                  const SizedBox(height: SqSpacing.m),
                ],
                SqButton(
                  key: const Key('sq-onboarding-submit'),
                  label: 'Отправить анкету',
                  loading: _submitting,
                  onPressed: _selectedSlugs.isNotEmpty && !_submitting
                      ? _submit
                      : null,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
