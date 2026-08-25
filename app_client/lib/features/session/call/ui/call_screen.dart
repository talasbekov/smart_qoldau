/// Экран аудио/видеозвонка консультации (прототипы `13-audio.png`,
/// `14-video.png`).
///
/// Исход консультации клиент НЕ фиксирует (БП-03): «Завершить» только
/// кладёт трубку и возвращает в чат той же консультации.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../../core/error_text.dart';
import '../../../../core/route_paths.dart';
import '../../../../l10n/app_localizations.dart';
import '../../chat/ui/session_header.dart';
import 'call_controls.dart';
import 'connection_banner.dart';

class CallScreen extends ConsumerStatefulWidget {
  const CallScreen({
    super.key,
    required this.consultationId,
    required this.format,
  });

  final String consultationId;

  /// Запрошенный формат. Реальный может оказаться ниже (отказ в камере) —
  /// он лежит в `CallState.format`.
  final SessionFormat format;

  @override
  ConsumerState<CallScreen> createState() => _CallScreenState();
}

class _CallScreenState extends ConsumerState<CallScreen> {
  @override
  void initState() {
    super.initState();
    // Звонок начинается сам: экран открывают из меню сессии, отдельная
    // кнопка «позвонить» здесь была бы лишним шагом.
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
    // Шапка сессии (специалист и оставшееся время) — та же, что в чате:
    // консультация одна, и второй источник тех же данных разошёлся бы с
    // первым.
    final chat = ref
        .watch(chatControllerProvider(widget.consultationId))
        .valueOrNull;

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: chat == null
          ? AppBar(
              title: Text(
                widget.format == SessionFormat.video
                    ? l10n.callVideoTitle
                    : l10n.callAudioTitle,
              ),
            )
          : SessionHeader(
              expertName: chat.consultation.expert.displayName,
              remaining: chat.remaining,
              menu: const SizedBox.shrink(),
              // Свой статус соединения экран звонка показывает сам.
              showOnline: false,
            ),
      body: SafeArea(
        child: switch (call.phase) {
          CallPhase.permissionDenied => _PermissionDenied(
            onOpenSettings: () => ref
                .read(callControllerProvider(widget.consultationId).notifier)
                .openSettings(),
            onBackToChat: _backToChat,
          ),
          CallPhase.failed => _Failed(
            errorCode: call.errorCode,
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
      children: [
        if (state.phase == CallPhase.reconnecting)
          ConnectionBanner(text: l10n.callReconnecting),
        if (state.cameraBlocked)
          ConnectionBanner(text: l10n.callCameraBlocked),
        Expanded(
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  state.format == SessionFormat.video
                      ? Icons.videocam
                      : Icons.headset_mic,
                  size: 72,
                  color: SqColors.primary,
                ),
                const SizedBox(height: SqSpacing.l),
                Text(
                  switch (state.phase) {
                    CallPhase.connected => l10n.callConnected,
                    CallPhase.disconnected => l10n.callEnd,
                    _ => l10n.callConnecting,
                  },
                  style: SqTypography.title,
                ),
              ],
            ),
          ),
        ),
        CallControls(
          micEnabled: state.micEnabled,
          camEnabled: state.camEnabled,
          showCamera:
              state.format == SessionFormat.video && !state.cameraBlocked,
          onToggleMic: onToggleMic,
          onToggleCam: onToggleCam,
          onEnd: onEnd,
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

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(SqSpacing.l),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SqEmptyState(
              icon: Icons.mic_off_outlined,
              title: l10n.callPermissionTitle,
              subtitle: l10n.callPermissionBody,
            ),
            const SizedBox(height: SqSpacing.xl),
            SqButton(
              key: const Key('sq-call-open-settings'),
              label: l10n.callOpenSettings,
              onPressed: onOpenSettings,
            ),
            const SizedBox(height: SqSpacing.m),
            SqButton(
              key: const Key('sq-call-back-to-chat'),
              kind: SqButtonKind.secondary,
              label: l10n.callContinueInChat,
              onPressed: onBackToChat,
            ),
          ],
        ),
      ),
    );
  }
}

class _Failed extends StatelessWidget {
  const _Failed({
    required this.errorCode,
    required this.offerChat,
    required this.onBackToChat,
  });

  final String? errorCode;
  final bool offerChat;
  final VoidCallback onBackToChat;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(SqSpacing.l),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SqEmptyState(
              icon: Icons.wifi_off_outlined,
              title: l10n.callFailedTitle,
              subtitle: errorCode == null
                  ? null
                  : errorText(context, ApiException(errorCode!, '', 0)),
            ),
            const SizedBox(height: SqSpacing.xl),
            SqButton(
              key: const Key('sq-call-continue-chat'),
              label: l10n.callContinueInChat,
              onPressed: onBackToChat,
            ),
          ],
        ),
      ),
    );
  }
}
