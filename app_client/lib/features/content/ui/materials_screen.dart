/// Вкладка «Материалы»: библиотека самопомощи со стриком и фильтрами.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/error_text.dart';
import '../../../core/route_paths.dart';
import '../../../l10n/app_localizations.dart';
import '../state/content_controller.dart';

const _kindLabels = <ContentKind?, String>{
  null: 'ALL',
  ContentKind.meditation: 'MEDITATION',
  ContentKind.music: 'MUSIC',
  ContentKind.article: 'ARTICLE',
  ContentKind.breathing: 'BREATHING',
};

class MaterialsScreen extends ConsumerStatefulWidget {
  const MaterialsScreen({super.key});

  @override
  ConsumerState<MaterialsScreen> createState() => _MaterialsScreenState();
}

class _MaterialsScreenState extends ConsumerState<MaterialsScreen> {
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scroll.hasClients) return;
    // Догружаем заранее, за экран до конца: иначе пользователь упирается в
    // край списка и ждёт.
    final remaining = _scroll.position.maxScrollExtent - _scroll.offset;
    if (remaining < 600) {
      unawaited(ref.read(contentListProvider.notifier).loadMore());
    }
  }

  String _kindLabel(AppLocalizations l10n, ContentKind? kind) {
    switch (kind) {
      case null:
        return l10n.materialsFilterAll;
      case ContentKind.meditation:
        return l10n.materialsFilterMeditation;
      case ContentKind.music:
        return l10n.materialsFilterMusic;
      case ContentKind.article:
        return l10n.materialsFilterArticle;
      case ContentKind.breathing:
        return l10n.materialsFilterBreathing;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final items = ref.watch(contentListProvider);
    final filter = ref.watch(contentFilterProvider);

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(title: Text(l10n.materialsTitle)),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const _StreakLine(),
            SizedBox(
              height: 48,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: SqSpacing.l),
                children: [
                  for (final kind in _kindLabels.keys)
                    Padding(
                      padding: const EdgeInsets.only(right: SqSpacing.s),
                      child: ChoiceChip(
                        key: Key('sq-content-filter-${_kindLabels[kind]}'),
                        label: Text(_kindLabel(l10n, kind)),
                        selected: filter.kind == kind,
                        onSelected: (_) =>
                            ref.read(contentFilterProvider.notifier).state =
                                ContentFilter(kind: kind),
                      ),
                    ),
                ],
              ),
            ),
            Expanded(
              child: items.when(
                loading: () => const Center(child: SqLoader()),
                error: (error, _) => Center(
                  child: Padding(
                    padding: const EdgeInsets.all(SqSpacing.l),
                    child: SqErrorView(
                      text: error is ApiException
                          ? errorText(context, error)
                          : l10n.errorGeneric,
                      onRetry: () => ref.invalidate(contentListProvider),
                      retryLabel: l10n.actionRetry,
                    ),
                  ),
                ),
                data: (page) => page.items.isEmpty
                    ? Center(
                        child: SqEmptyState(
                          key: const Key('sq-content-empty'),
                          icon: Icons.library_books_outlined,
                          title: l10n.materialsEmpty,
                        ),
                      )
                    : ListView.builder(
                        controller: _scroll,
                        padding: const EdgeInsets.all(SqSpacing.l),
                        itemCount:
                            page.items.length + (page.loadingMore ? 1 : 0),
                        itemBuilder: (context, index) =>
                            index >= page.items.length
                            ? const Padding(
                                padding: EdgeInsets.all(SqSpacing.l),
                                child: SqLoader(),
                              )
                            : _ItemCard(item: page.items[index]),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Стрик — обратная связь, а не награда: ни бейджей, ни влияния на цену.
class _StreakLine extends ConsumerWidget {
  const _StreakLine();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final streak = ref.watch(contentStreakProvider).valueOrNull;
    // Стрик не загрузился — строки нет: библиотека не должна зависеть от
    // счётчика.
    if (streak == null) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        SqSpacing.l,
        SqSpacing.m,
        SqSpacing.l,
        0,
      ),
      child: Row(
        children: [
          const Icon(
            Icons.local_fire_department_outlined,
            size: 18,
            color: SqColors.primary,
          ),
          const SizedBox(width: SqSpacing.s),
          Expanded(
            child: Text(
              streak.currentDays > 0
                  ? l10n.materialsStreak(streak.currentDays)
                  : l10n.materialsCompleted(streak.completedCount),
              style: SqTypography.caption.copyWith(color: SqColors.primary),
            ),
          ),
        ],
      ),
    );
  }
}

class _ItemCard extends StatelessWidget {
  const _ItemCard({required this.item});

  final ContentItem item;

  IconData get _icon {
    switch (item.kind) {
      case ContentKind.meditation:
        return Icons.self_improvement_outlined;
      case ContentKind.music:
        return Icons.music_note_outlined;
      case ContentKind.article:
        return Icons.article_outlined;
      case ContentKind.breathing:
        return Icons.air_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final minutes = item.durationSec == null
        ? null
        : (item.durationSec! / 60).round();

    return Padding(
      padding: const EdgeInsets.only(bottom: SqSpacing.m),
      child: InkWell(
        key: Key('sq-content-item-${item.id}'),
        // Заперт — ведём на экран подписки, а не в плеер: сервер ссылку всё
        // равно не отдаст, и упереться в отказ после нажатия «слушать»
        // человеку незачем.
        onTap: () => item.locked
            ? context.push(RoutePaths.premium)
            : context.push('/materials/${item.id}'),
        child: SqCard(
          child: Padding(
            padding: const EdgeInsets.all(SqSpacing.m),
            child: Row(
              children: [
                Icon(_icon, color: SqColors.primary),
                const SizedBox(width: SqSpacing.m),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item.title, style: SqTypography.title),
                      Text(
                        item.summary,
                        style: SqTypography.caption.copyWith(
                          color: SqColors.textSecondary,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (minutes != null)
                        Text(
                          l10n.materialsDuration(minutes),
                          style: SqTypography.caption.copyWith(
                            color: SqColors.textTertiary,
                          ),
                        ),
                    ],
                  ),
                ),
                if (item.locked)
                  Tooltip(
                    message: l10n.materialsPremiumOnly,
                    child: Icon(
                      Icons.lock_outline,
                      key: Key('sq-content-lock-${item.id}'),
                      color: SqColors.textSecondary,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
