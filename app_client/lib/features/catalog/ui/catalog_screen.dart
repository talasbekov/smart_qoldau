/// Каталог специалистов: список с фильтрами и переход в профиль.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/error_text.dart';
import '../../../core/route_paths.dart';
import '../../../l10n/app_localizations.dart';
import '../state/catalog_controller.dart';
import '../state/favorites_controller.dart';
import 'expert_card.dart';
import 'expert_grid.dart';
import 'filters_sheet.dart';

class CatalogScreen extends ConsumerWidget {
  const CatalogScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final catalog = ref.watch(catalogControllerProvider);
    final filters = ref.watch(catalogFiltersProvider);

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(
        title: Text(l10n.catalogTitle),
        actions: [
          IconButton(
            key: const Key('sq-catalog-favorites'),
            icon: const Icon(Icons.favorite_border),
            onPressed: () => context.push(RoutePaths.favorites),
          ),
          IconButton(
            key: const Key('sq-catalog-filters'),
            icon: Icon(
              filters.isEmpty ? Icons.tune : Icons.filter_alt,
              color: filters.isEmpty ? null : SqColors.primary,
            ),
            onPressed: () => showCatalogFiltersSheet(context),
          ),
        ],
      ),
      body: SafeArea(
        child: catalog.when(
          loading: () => const Center(child: SqLoader()),
          error: (error, stackTrace) => Center(
            child: Padding(
              padding: const EdgeInsets.all(SqSpacing.l),
              child: SqErrorView(
                text: error is ApiException
                    ? errorText(context, error)
                    : l10n.errorGeneric,
                onRetry: () =>
                    ref.read(catalogControllerProvider.notifier).retry(),
                retryLabel: l10n.actionRetry,
              ),
            ),
          ),
          data: (experts) => experts.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(SqSpacing.l),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SqEmptyState(
                          icon: Icons.search_off,
                          title: l10n.catalogEmpty,
                        ),
                        const SizedBox(height: SqSpacing.l),
                        SqButton(
                          key: const Key('sq-catalog-reset-filters'),
                          kind: SqButtonKind.secondary,
                          label: l10n.catalogResetFilters,
                          onPressed: () =>
                              ref.read(catalogFiltersProvider.notifier).reset(),
                        ),
                      ],
                    ),
                  ),
                )
              // Сетка по прототипу `Web - Каталог`: сколько карточек по
              // 270 px влезло, столько колонок. На телефоне это одна
              // колонка, то есть прежний список.
              : ExpertGrid(
                  itemCount: experts.length,
                  itemBuilder: (context, index) {
                    final expert = experts[index];
                    return ExpertCard(
                      expert: expert,
                      isFavorite: ref.watch(isFavoriteProvider(expert.id)),
                      onToggleFavorite: () => ref
                          .read(favoritesControllerProvider.notifier)
                          .toggle(expert),
                      onTap: () => context.push(RoutePaths.expert(expert.id)),
                    );
                  },
                  // Каталог приходит страницами по 20 (E11a, задача 7).
                  footer: ref.read(catalogControllerProvider.notifier).hasMore
                      ? Center(
                          child: TextButton(
                            key: const Key('sq-catalog-load-more'),
                            onPressed: () => ref
                                .read(catalogControllerProvider.notifier)
                                .loadMore(),
                            child: Text(l10n.consultationLoadMore),
                          ),
                        )
                      : null,
                ),
        ),
      ),
    );
  }
}
