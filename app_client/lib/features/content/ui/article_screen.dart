/// Экран статьи: markdown, прогресс чтения и вопрос «было полезно?».
library;

import 'package:flutter/material.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../core/error_text.dart';
import '../../../l10n/app_localizations.dart';
import '../data/content_repository.dart';
import '../state/content_controller.dart';

/// Прогресс шлём не на каждый пиксель прокрутки, а когда доля прочитанного
/// заметно изменилась: иначе один проход по длинной статье — это сотня
/// запросов ни о чём.
const _progressStepPermille = 100;

class ArticleScreen extends ConsumerStatefulWidget {
  const ArticleScreen({super.key, required this.id});

  final String id;

  @override
  ConsumerState<ArticleScreen> createState() => _ArticleScreenState();
}

class _ArticleScreenState extends ConsumerState<ArticleScreen> {
  final _scroll = ScrollController();
  int _sentPermille = 0;
  bool _voted = false;

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
    final max = _scroll.position.maxScrollExtent;
    // Статья умещается на экран целиком — считаем её прочитанной по факту
    // открытия: прокручивать нечего.
    final permille = max <= 0
        ? 1000
        : ((_scroll.offset / max) * 1000).clamp(0, 1000).round();
    if (permille - _sentPermille < _progressStepPermille && permille != 1000) {
      return;
    }
    if (permille <= _sentPermille) return;
    _sentPermille = permille;
    unawaitedSave(permille);
  }

  void unawaitedSave(int permille) {
    // Прогресс — фоновая деталь: его неудача не должна мешать чтению.
    ref
        .read(contentRepositoryProvider)
        .saveProgress(widget.id, permille)
        .catchError(
          (_) => const ContentProgress(positionPermille: 0, completed: false),
        );
  }

  Future<void> _vote(bool useful) async {
    setState(() => _voted = true);
    await ref
        .read(contentRepositoryProvider)
        .vote(widget.id, useful: useful)
        .catchError((_) => const ContentVotes(usefulYes: 0, usefulNo: 0));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final item = ref.watch(contentItemProvider(widget.id));

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(title: Text(item.valueOrNull?.title ?? '')),
      body: SafeArea(
        child: item.when(
          loading: () => const Center(child: SqLoader()),
          error: (error, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(SqSpacing.l),
              child: SqErrorView(
                text: error is ApiException
                    ? errorText(context, error)
                    : l10n.errorGeneric,
                onRetry: () => ref.invalidate(contentItemProvider(widget.id)),
                retryLabel: l10n.actionRetry,
              ),
            ),
          ),
          data: (data) {
            final body = data.body;
            final markdown = body is ArticleBody ? body.markdown : '';
            return ListView(
              controller: _scroll,
              padding: const EdgeInsets.all(SqSpacing.l),
              children: [
                // Заголовок уже в шапке экрана — второй раз он только
                // отнимает первый экран у самого текста.
                MarkdownBody(data: markdown),
                const SizedBox(height: SqSpacing.xl),
                Text(l10n.materialsUseful, style: SqTypography.title),
                const SizedBox(height: SqSpacing.s),
                Row(
                  children: [
                    SqButton(
                      key: const Key('sq-content-useful-yes'),
                      label: l10n.materialsUsefulYes,
                      kind: SqButtonKind.secondary,
                      onPressed: _voted ? null : () => _vote(true),
                    ),
                    const SizedBox(width: SqSpacing.m),
                    SqButton(
                      key: const Key('sq-content-useful-no'),
                      label: l10n.materialsUsefulNo,
                      kind: SqButtonKind.secondary,
                      onPressed: _voted ? null : () => _vote(false),
                    ),
                  ],
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
