/// Избранные специалисты клиента.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/error_text.dart';
import '../../../core/route_paths.dart';
import '../../../l10n/app_localizations.dart';
import '../state/favorites_controller.dart';
import 'expert_card.dart';
import 'expert_grid.dart';

class FavoritesScreen extends ConsumerWidget {
  const FavoritesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final favorites = ref.watch(favoritesControllerProvider);

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(title: Text(l10n.favoritesTitle)),
      body: SafeArea(
        child: favorites.when(
          loading: () => const Center(child: SqLoader()),
          error: (error, stackTrace) => Center(
            child: Padding(
              padding: const EdgeInsets.all(SqSpacing.l),
              child: SqErrorView(
                text: error is ApiException
                    ? errorText(context, error)
                    : l10n.errorGeneric,
                onRetry: () =>
                    ref.read(favoritesControllerProvider.notifier).reload(),
                retryLabel: l10n.actionRetry,
              ),
            ),
          ),
          data: (experts) => experts.isEmpty
              ? Center(
                  child: SqEmptyState(
                    icon: Icons.favorite_border,
                    title: l10n.favoritesEmpty,
                  ),
                )
              // Та же сетка, что в каталоге: избранное — это тот же
              // список специалистов, и на широком экране он обязан
              // выглядеть так же, а не столбцом в одну карточку.
              : ExpertGrid(
                  itemCount: experts.length,
                  itemBuilder: (context, index) {
                    final expert = experts[index];
                    return ExpertCard(
                      expert: expert,
                      isFavorite: true,
                      onToggleFavorite: () => ref
                          .read(favoritesControllerProvider.notifier)
                          .toggle(expert),
                      onTap: () => context.push(RoutePaths.expert(expert.id)),
                    );
                  },
                  footer: ref.read(favoritesControllerProvider.notifier).hasMore
                      ? Center(
                          child: TextButton(
                            key: const Key('sq-favorites-load-more'),
                            onPressed: () => ref
                                .read(favoritesControllerProvider.notifier)
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
