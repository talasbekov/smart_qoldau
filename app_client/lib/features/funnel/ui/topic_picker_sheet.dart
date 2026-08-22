/// Шторка выбора темы консультации.
///
/// Нужна там, где тема неизвестна приложению: в `ConsultationClientDto`
/// бэкенда темы нет (проверено по DTO), поэтому «Продолжить с тем же
/// психологом» (задача 15) обязан спросить её у клиента, а не угадывать по
/// специализациям специалиста.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../core/error_text.dart';
import '../../../core/locale_controller.dart';
import '../../../l10n/app_localizations.dart';
import '../../home/data/topics_repository.dart';

/// Справочник тем на языке интерфейса.
final topicsProvider = FutureProvider.autoDispose<List<Topic>>((ref) {
  final locale = localeToApi(ref.watch(localeControllerProvider));
  return ref.read(topicsRepositoryProvider).topics(locale: locale);
});

/// Показывает шторку и возвращает выбранную тему (`null` — закрыли).
Future<Topic?> showTopicPickerSheet(BuildContext context) =>
    showModalBottomSheet<Topic>(
      context: context,
      isScrollControlled: true,
      backgroundColor: SqColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(SqRadius.l)),
      ),
      builder: (context) => const _TopicPickerSheet(),
    );

class _TopicPickerSheet extends ConsumerWidget {
  const _TopicPickerSheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final topics = ref.watch(topicsProvider);

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(SqSpacing.l),
        child: topics.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(SqSpacing.xl),
            child: SqLoader(),
          ),
          error: (error, stackTrace) => SqErrorView(
            text: error is ApiException
                ? errorText(context, error)
                : l10n.errorGeneric,
            onRetry: () => ref.invalidate(topicsProvider),
            retryLabel: l10n.actionRetry,
          ),
          data: (list) => Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                l10n.homeTopicsTitle,
                style: SqTypography.h2,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: SqSpacing.m),
              Flexible(
                child: ListView(
                  shrinkWrap: true,
                  children: [
                    for (final topic in list)
                      ListTile(
                        key: Key('sq-topic-option-${topic.slug}'),
                        title: Text(topic.name, style: SqTypography.body),
                        onTap: () => Navigator.of(context).pop(topic),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
