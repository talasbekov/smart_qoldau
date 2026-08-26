/// Плеер медитаций и музыки: ссылку выдаёт сервер, доступ решает он же.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/error_text.dart';
import '../../../core/route_paths.dart';
import '../../../l10n/app_localizations.dart';
import '../data/content_repository.dart';
import '../state/audio_port.dart';
import '../state/content_controller.dart';

class PlayerScreen extends ConsumerStatefulWidget {
  const PlayerScreen({super.key, required this.id});

  final String id;

  @override
  ConsumerState<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends ConsumerState<PlayerScreen> {
  bool _playing = false;
  bool _busy = false;
  String? _error;
  bool _needsPremium = false;

  Future<void> _toggle() async {
    final audio = ref.read(audioPortProvider);
    if (_playing) {
      await audio.pause();
      setState(() => _playing = false);
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
      _needsPremium = false;
    });
    try {
      // Ссылку спрашиваем у сервера каждый раз: она подписана и живёт
      // минуты, а доступ проверяется именно на её выдаче.
      final media = await ref.read(contentRepositoryProvider).media(widget.id);
      await audio.play(media.url);
      setState(() => _playing = true);
      // Запуск засчитываем как начало практики, чтобы стрик считался и по
      // аудио, а не только по статьям.
      unawaited(
        ref
            .read(contentRepositoryProvider)
            .saveProgress(widget.id, 1000)
            .catchError(
              (_) => const ContentProgress(
                positionPermille: 0,
                completed: false,
              ),
            ),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = errorText(context, e);
        _needsPremium = e.code == ApiErrorCode.premiumRequired;
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
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
          data: (data) => Padding(
            padding: const EdgeInsets.all(SqSpacing.l),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  data.kind == ContentKind.music
                      ? Icons.music_note_outlined
                      : Icons.self_improvement_outlined,
                  size: 64,
                  color: SqColors.primary,
                ),
                const SizedBox(height: SqSpacing.l),
                Text(data.summary, style: SqTypography.body),
                const SizedBox(height: SqSpacing.xl),
                SqButton(
                  key: const Key('sq-player-play'),
                  label: _playing ? l10n.playerPause : l10n.playerPlay,
                  loading: _busy,
                  onPressed: _toggle,
                ),
                if (_error != null) ...[
                  const SizedBox(height: SqSpacing.m),
                  Text(
                    _error!,
                    textAlign: TextAlign.center,
                    style: SqTypography.body.copyWith(color: SqColors.danger),
                  ),
                ],
                if (_needsPremium) ...[
                  const SizedBox(height: SqSpacing.m),
                  SqButton(
                    key: const Key('sq-player-premium'),
                    label: l10n.premiumTitle,
                    kind: SqButtonKind.secondary,
                    onPressed: () => context.push(RoutePaths.premium),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
