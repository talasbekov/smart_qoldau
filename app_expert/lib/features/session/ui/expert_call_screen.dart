/// Экран аудио/видеозвонка консультации со стороны эксперта (E7 задача
/// 13) — тонкая обёртка над `CallController` из `shared` (задача 2,
/// переиспользуется БЕЗ изменений: контроллер звонка не зависит от роли —
/// в отличие от чата, ему не нужна форма `ConsultationClientDto`/
/// `ConsultationExpertDto`, только `consultationId`). Исход консультации
/// здесь не фиксируется (см. `OutcomeSheet`) — «Завершить» только кладёт
/// трубку и возвращает в чат.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/route_paths.dart';
import '../../../l10n/app_localizations.dart';
import '../state/expert_session_controller.dart';
import 'session_header_wrapper.dart';

class ExpertCallScreen extends ConsumerStatefulWidget {
  const ExpertCallScreen({
    super.key,
    required this.consultationId,
    required this.format,
  });

  final String consultationId;
  final SessionFormat format;

  @override
  ConsumerState<ExpertCallScreen> createState() => _ExpertCallScreenState();
}

class _ExpertCallScreenState extends ConsumerState<ExpertCallScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref
          .read(callControllerProvider(widget.consultationId).notifier)
          .start(widget.format);
    });
  }

  void _backToChat() => context.go(RoutePaths.session(widget.consultationId));

  Future<void> _end() async {
    await ref
        .read(callControllerProvider(widget.consultationId).notifier)
        .hangUp();
    if (mounted) _backToChat();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final call = ref.watch(callControllerProvider(widget.consultationId));
    final session = ref
        .watch(expertSessionControllerProvider(widget.consultationId))
        .valueOrNull;

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: session == null
          ? AppBar(title: Text(l10n.callScreenTitle))
          : SessionHeaderWrapper(
              clientCode: session.consultation.clientCode,
              topicSlug: session.consultation.topicSlug,
              remaining: session.remaining,
            ),
      body: SafeArea(
        child: Center(
          child: switch (call.phase) {
            CallPhase.permissionDenied => _PermissionDenied(
              onOpenSettings: () => ref
                  .read(callControllerProvider(widget.consultationId).notifier)
                  .openSettings(),
              onBackToChat: _backToChat,
            ),
            CallPhase.failed => _Failed(
              offerChat: call.offerChatFallback,
              onBackToChat: _backToChat,
            ),
            _ => _ActiveCall(
              state: call,
              onToggleMic: () => ref
                  .read(callControllerProvider(widget.consultationId).notifier)
                  .toggleMic(),
              onToggleCam: () => ref
                  .read(callControllerProvider(widget.consultationId).notifier)
                  .toggleCam(),
              onEnd: _end,
            ),
          },
        ),
      ),
    );
  }
}

class _ActiveCall extends StatelessWidget {
  const _ActiveCall({
    required this.state,
    required this.onToggleMic,
    required this.onToggleCam,
    required this.onEnd,
  });

  final CallState state;
  final VoidCallback onToggleMic;
  final VoidCallback onToggleCam;
  final VoidCallback onEnd;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(switch (state.phase) {
          CallPhase.connecting => l10n.callConnecting,
          CallPhase.reconnecting => l10n.callReconnecting,
          _ => l10n.callInProgress,
        }, style: SqTypography.title),
        const SizedBox(height: 24),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            IconButton(
              key: const Key('sq-call-mic'),
              icon: Icon(state.micEnabled ? Icons.mic : Icons.mic_off),
              onPressed: onToggleMic,
            ),
            if (state.format == SessionFormat.video && !state.cameraBlocked)
              IconButton(
                key: const Key('sq-call-cam'),
                icon: Icon(
                  state.camEnabled ? Icons.videocam : Icons.videocam_off,
                ),
                onPressed: onToggleCam,
              ),
            IconButton(
              key: const Key('sq-call-end'),
              icon: const Icon(Icons.call_end, color: SqColors.danger),
              onPressed: onEnd,
            ),
          ],
        ),
      ],
    );
  }
}

class _PermissionDenied extends StatelessWidget {
  const _PermissionDenied({
    required this.onOpenSettings,
    required this.onBackToChat,
  });

  final VoidCallback onOpenSettings;
  final VoidCallback onBackToChat;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(l10n.callMicDenied, style: SqTypography.body),
        const SizedBox(height: 16),
        ElevatedButton(
          onPressed: onOpenSettings,
          child: Text(l10n.actionOpenSettings),
        ),
        TextButton(onPressed: onBackToChat, child: Text(l10n.actionBackToChat)),
      ],
    );
  }
}

class _Failed extends StatelessWidget {
  const _Failed({required this.offerChat, required this.onBackToChat});

  final bool offerChat;
  final VoidCallback onBackToChat;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          offerChat ? l10n.callOfferChatFallback : l10n.callFailed,
          style: SqTypography.body,
        ),
        const SizedBox(height: 16),
        ElevatedButton(
          onPressed: onBackToChat,
          child: Text(l10n.actionBackToChat),
        ),
      ],
    );
  }
}
