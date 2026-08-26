/// Дыхательная техника: фазы по таймеру и счёт циклов.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../core/error_text.dart';
import '../../../l10n/app_localizations.dart';
import '../data/content_repository.dart';
import '../state/content_controller.dart';

class BreathingScreen extends ConsumerStatefulWidget {
  const BreathingScreen({super.key, required this.id});

  final String id;

  @override
  ConsumerState<BreathingScreen> createState() => _BreathingScreenState();
}

class _BreathingScreenState extends ConsumerState<BreathingScreen> {
  Timer? _timer;
  int _phaseIndex = 0;
  int _cycle = 0; // 0 — практика не идёт
  int _secondsLeft = 0;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _toggle(BreathingBody body) {
    if (_cycle > 0) {
      _stop();
      return;
    }
    setState(() {
      _cycle = 1;
      _phaseIndex = 0;
      _secondsLeft = body.phases.first.seconds;
    });
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _tick(body));
  }

  void _stop() {
    _timer?.cancel();
    _timer = null;
    setState(() {
      _cycle = 0;
      _phaseIndex = 0;
      _secondsLeft = 0;
    });
  }

  void _tick(BreathingBody body) {
    if (_secondsLeft > 1) {
      setState(() => _secondsLeft--);
      return;
    }

    final isLastPhase = _phaseIndex >= body.phases.length - 1;
    if (!isLastPhase) {
      setState(() {
        _phaseIndex++;
        _secondsLeft = body.phases[_phaseIndex].seconds;
      });
      return;
    }

    // Цикл закончился.
    if (_cycle >= body.cycles) {
      _timer?.cancel();
      _timer = null;
      // Практика пройдена — прогресс уходит на сервер: без него стрик не
      // считается, а он и есть вся обратная связь этого экрана.
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
      setState(() {
        _cycle = 0;
        _phaseIndex = 0;
        _secondsLeft = 0;
      });
      return;
    }

    setState(() {
      _cycle++;
      _phaseIndex = 0;
      _secondsLeft = body.phases.first.seconds;
    });
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
            if (body is! BreathingBody || body.phases.isEmpty) {
              return Center(child: Text(l10n.errorGeneric));
            }
            final phase = body.phases[_phaseIndex];

            return Padding(
              padding: const EdgeInsets.all(SqSpacing.l),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(data.summary, style: SqTypography.body),
                  const SizedBox(height: SqSpacing.xl),
                  Text(phase.name, style: SqTypography.h1),
                  const SizedBox(height: SqSpacing.s),
                  Text(
                    _cycle > 0 ? '$_secondsLeft' : '${phase.seconds}',
                    style: SqTypography.h1.copyWith(color: SqColors.primary),
                  ),
                  const SizedBox(height: SqSpacing.m),
                  if (_cycle > 0)
                    Text(
                      l10n.breathingCycle(_cycle, body.cycles),
                      style: SqTypography.caption.copyWith(
                        color: SqColors.textSecondary,
                      ),
                    ),
                  const SizedBox(height: SqSpacing.xl),
                  SqButton(
                    key: const Key('sq-breathing-start'),
                    label: _cycle > 0 ? l10n.breathingStop : l10n.breathingStart,
                    onPressed: () => _toggle(body),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}
