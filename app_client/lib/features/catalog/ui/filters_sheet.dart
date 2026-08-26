/// Шторка фильтров каталога: тема, язык, формат, сортировка.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';
import '../../funnel/ui/format_sheet.dart' show formatLabel;
import '../../funnel/ui/topic_picker_sheet.dart' show topicsProvider;
import '../state/catalog_controller.dart';

Future<void> showCatalogFiltersSheet(BuildContext context) =>
    showSqSheetOrDialog<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: SqColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(SqRadius.l)),
      ),
      builder: (context) => const _FiltersSheet(),
    );

class _FiltersSheet extends ConsumerWidget {
  const _FiltersSheet();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final filters = ref.watch(catalogFiltersProvider);
    final controller = ref.read(catalogFiltersProvider.notifier);
    final topics = ref.watch(topicsProvider).valueOrNull ?? const <Topic>[];

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(SqSpacing.l),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(l10n.catalogFilters, style: SqTypography.h2),
              const SizedBox(height: SqSpacing.l),
              Text(l10n.filterTopic, style: SqTypography.title),
              const SizedBox(height: SqSpacing.s),
              Wrap(
                spacing: SqSpacing.s,
                runSpacing: SqSpacing.s,
                children: [
                  _FilterOption(
                    label: l10n.filterAny,
                    selected: filters.topicSlug == null,
                    onTap: () => controller.update(clearTopic: true),
                  ),
                  for (final topic in topics)
                    _FilterOption(
                      key: Key('sq-filter-topic-${topic.slug}'),
                      label: topic.name,
                      selected: filters.topicSlug == topic.slug,
                      onTap: () => controller.update(topicSlug: topic.slug),
                    ),
                ],
              ),
              const SizedBox(height: SqSpacing.l),
              Text(l10n.filterLanguage, style: SqTypography.title),
              const SizedBox(height: SqSpacing.s),
              Wrap(
                spacing: SqSpacing.s,
                runSpacing: SqSpacing.s,
                children: [
                  _FilterOption(
                    label: l10n.filterAny,
                    selected: filters.language == null,
                    onTap: () => controller.update(clearLanguage: true),
                  ),
                  for (final entry in {
                    'ru': l10n.languageRussian,
                    'kz': l10n.languageKazakh,
                    'en': l10n.languageEnglish,
                  }.entries)
                    _FilterOption(
                      key: Key('sq-filter-language-${entry.key}'),
                      label: entry.value,
                      selected: filters.language == entry.key,
                      onTap: () => controller.update(language: entry.key),
                    ),
                ],
              ),
              const SizedBox(height: SqSpacing.l),
              Text(l10n.filterFormat, style: SqTypography.title),
              const SizedBox(height: SqSpacing.s),
              Wrap(
                spacing: SqSpacing.s,
                runSpacing: SqSpacing.s,
                children: [
                  _FilterOption(
                    label: l10n.filterAny,
                    selected: filters.format == null,
                    onTap: () => controller.update(clearFormat: true),
                  ),
                  for (final format in SessionFormat.values)
                    _FilterOption(
                      key: Key('sq-filter-format-${format.wireValue}'),
                      label: formatLabel(l10n, format),
                      selected: filters.format == format,
                      onTap: () => controller.update(format: format),
                    ),
                ],
              ),
              const SizedBox(height: SqSpacing.l),
              Text(l10n.filterSort, style: SqTypography.title),
              const SizedBox(height: SqSpacing.s),
              Wrap(
                spacing: SqSpacing.s,
                runSpacing: SqSpacing.s,
                children: [
                  _FilterOption(
                    label: l10n.filterAny,
                    selected: filters.sort == null,
                    onTap: () => controller.update(clearSort: true),
                  ),
                  for (final entry in {
                    CatalogSort.priceAsc: l10n.sortPriceAsc,
                    CatalogSort.priceDesc: l10n.sortPriceDesc,
                    CatalogSort.rating: l10n.sortRating,
                  }.entries)
                    _FilterOption(
                      key: Key('sq-filter-sort-${entry.key.wireValue}'),
                      label: entry.value,
                      selected: filters.sort == entry.key,
                      onTap: () => controller.update(sort: entry.key),
                    ),
                ],
              ),
              const SizedBox(height: SqSpacing.xl),
              SqButton(
                key: const Key('sq-filters-apply'),
                label: l10n.actionApply,
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FilterOption extends StatelessWidget {
  const _FilterOption({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: SqChip(label: label, selected: selected),
  );
}
