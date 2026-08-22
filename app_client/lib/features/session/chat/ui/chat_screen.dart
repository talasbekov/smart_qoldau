/// Экран чата консультации (прототип `12-chat.png`).
///
/// Быстрых ответов-чипов, вложений и голосовых из прототипа здесь нет: у
/// бэкенда в переписке есть только текст (`MessageDto`), а рисовать
/// нерабочие элементы в сессии с психологом — хуже, чем не рисовать их.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../../core/error_text.dart';
import '../../../../core/locale_controller.dart';
import '../../../../core/route_paths.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../review/state/review_controller.dart';
import '../state/chat_controller.dart';
import 'message_bubble.dart';
import 'session_header.dart';
import 'session_menu.dart';

class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({super.key, required this.consultationId});

  final String consultationId;

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  String? _error;

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _send() {
    final text = _input.text.trim();
    if (text.isEmpty) return;
    ref
        .read(chatControllerProvider(widget.consultationId).notifier)
        .send(text);
    _input.clear();
  }

  Future<void> _confirmCancel() async {
    final l10n = AppLocalizations.of(context)!;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l10n.sessionCancelTitle),
        content: Text(l10n.sessionCancelBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(l10n.actionClose),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(l10n.sessionMenuCancel),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await ref
          .read(chatControllerProvider(widget.consultationId).notifier)
          .cancel();
      if (!mounted) return;
      context.go(RoutePaths.home);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = errorText(context, error));
    } catch (_) {
      if (mounted) {
        setState(() => _error = AppLocalizations.of(context)!.errorGeneric);
      }
    }
  }

  /// Консультация закрылась: завершённая — на оценку (если её ещё не
  /// предлагали), отменённая — на главную. Оценивать отменённую нечего.
  void _onConsultationClosed(ConsultationStatus status) {
    if (status == ConsultationStatus.active) return;

    if (status == ConsultationStatus.completed) {
      final reviewed = ref
              .read(sharedPreferencesProvider)
              .getBool(reviewedFlagKey(widget.consultationId)) ??
          false;
      if (!reviewed) {
        context.go(RoutePaths.review(widget.consultationId));
        return;
      }
    }
    context.go(RoutePaths.home);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final provider = chatControllerProvider(widget.consultationId);

    ref.listen(provider, (previous, next) {
      final status = next.valueOrNull?.status;
      final before = previous?.valueOrNull?.status;
      // Уводим только когда консультация закрылась ПРИ КЛИЕНТЕ. Открытый
      // из истории уже завершённый чат (задача 17) обязан остаться чатом:
      // человек пришёл перечитать переписку, а не оценивать заново.
      if (status == null || before != ConsultationStatus.active) return;
      if (status == before) return;
      _onConsultationClosed(status);
    });

    final asyncState = ref.watch(provider);

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: asyncState.valueOrNull == null
          ? AppBar()
          : SessionHeader(
              expertName: asyncState.requireValue.consultation.expert.displayName,
              remaining: asyncState.requireValue.remaining,
              menu: SessionMenu(
                onCancel: _confirmCancel,
                onEscalate: (format) =>
                    context.push(RoutePaths.call(widget.consultationId, format)),
              ),
            ),
      body: SafeArea(
        child: asyncState.when(
          loading: () => const Center(child: SqLoader()),
          error: (error, stackTrace) => Center(
            child: Padding(
              padding: const EdgeInsets.all(SqSpacing.l),
              child: SqErrorView(
                text: error is ApiException
                    ? errorText(context, error)
                    : l10n.errorGeneric,
                onRetry: () => ref.invalidate(provider),
                retryLabel: l10n.actionRetry,
              ),
            ),
          ),
          data: (state) => Column(
            children: [
              Expanded(child: _messages(state)),
              if (state.peerTyping)
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: SqSpacing.l,
                    vertical: SqSpacing.xs,
                  ),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      l10n.chatPeerTyping,
                      style: SqTypography.caption.copyWith(
                        color: SqColors.textSecondary,
                      ),
                    ),
                  ),
                ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: SqSpacing.l),
                  child: Text(
                    _error!,
                    key: const Key('sq-chat-error'),
                    style: SqTypography.body.copyWith(color: SqColors.danger),
                    textAlign: TextAlign.center,
                  ),
                ),
              _composer(state),
            ],
          ),
        ),
      ),
    );
  }

  Widget _messages(ChatState state) {
    final l10n = AppLocalizations.of(context)!;

    return ListView(
      controller: _scroll,
      padding: const EdgeInsets.all(SqSpacing.l),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.lock_outline, size: 14, color: SqColors.textTertiary),
            const SizedBox(width: SqSpacing.s),
            Flexible(
              child: Text(
                l10n.chatConfidentialNotice,
                style: SqTypography.caption.copyWith(
                  color: SqColors.textTertiary,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ),
        const SizedBox(height: SqSpacing.m),
        for (final message in state.messages)
          MessageBubble(
            key: Key('sq-chat-message-${message.id}'),
            text: message.text,
            isMine: message.senderRole == clientSenderRole,
            createdAt: message.createdAt,
          ),
        for (final pending in state.pending)
          MessageBubble(
            key: Key('sq-chat-pending-${pending.localId}'),
            text: pending.text,
            isMine: true,
            delivery: pending.failed
                ? BubbleDelivery.failed
                : BubbleDelivery.sending,
            onResend: pending.failed
                ? () => ref
                      .read(
                        chatControllerProvider(widget.consultationId).notifier,
                      )
                      .resend(pending.localId)
                : null,
          ),
        if (state.nextCursor != null)
          Center(
            child: TextButton(
              key: const Key('sq-chat-load-more'),
              onPressed: state.loadingMore
                  ? null
                  : () => ref
                        .read(
                          chatControllerProvider(
                            widget.consultationId,
                          ).notifier,
                        )
                        .loadMore(),
              child: Text(l10n.actionContinue),
            ),
          ),
      ],
    );
  }

  Widget _composer(ChatState state) {
    final l10n = AppLocalizations.of(context)!;

    if (!state.canSend) {
      return Padding(
        padding: const EdgeInsets.all(SqSpacing.l),
        child: Text(
          l10n.chatInputDisabled,
          style: SqTypography.body.copyWith(color: SqColors.textSecondary),
          textAlign: TextAlign.center,
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.all(SqSpacing.l),
      child: Row(
        children: [
          Expanded(
            child: SqTextField(
              key: const Key('sq-chat-input'),
              controller: _input,
              hint: l10n.chatInputHint,
              onChanged: (_) => ref
                  .read(chatControllerProvider(widget.consultationId).notifier)
                  .typing(),
            ),
          ),
          const SizedBox(width: SqSpacing.m),
          IconButton.filled(
            key: const Key('sq-chat-send'),
            onPressed: _send,
            icon: const Icon(Icons.send),
          ),
        ],
      ),
    );
  }
}
