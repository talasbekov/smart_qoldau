/// Экран чата консультации со стороны эксперта (E7 задача 13) — тонкая
/// обёртка над `ExpertSessionController`. Меню сессии здесь не «отменить»
/// (клиентское действие), а «Завершить» → `OutcomeSheet`; заметка — иконка
/// в шапке, открывает `NoteEditor` шторкой.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/route_paths.dart';
import '../../../l10n/app_localizations.dart';
import '../../consultations/ui/note_editor.dart';
import '../../consultations/ui/outcome_sheet.dart';
import '../state/expert_session_controller.dart';
import 'session_header_wrapper.dart';

class ExpertChatScreen extends ConsumerStatefulWidget {
  const ExpertChatScreen({super.key, required this.consultationId});

  final String consultationId;

  @override
  ConsumerState<ExpertChatScreen> createState() => _ExpertChatScreenState();
}

class _ExpertChatScreenState extends ConsumerState<ExpertChatScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();

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
        .read(expertSessionControllerProvider(widget.consultationId).notifier)
        .send(text);
    _input.clear();
  }

  Future<void> _openOutcomeSheet() async {
    final result = await showOutcomeSheet(
      context,
      consultationId: widget.consultationId,
    );
    if (result != null && mounted) context.go(RoutePaths.consultations);
  }

  void _openNote() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => NoteEditor(consultationId: widget.consultationId),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final async = ref.watch(
      expertSessionControllerProvider(widget.consultationId),
    );

    return async.when(
      loading: () =>
          const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (error, _) => Scaffold(
        body: Center(
          child: Text(
            error is ApiException ? error.message : l10n.errorLoadFailed,
            style: SqTypography.body.copyWith(color: SqColors.danger),
          ),
        ),
      ),
      data: (state) {
        final consultation = state.consultation;
        return Scaffold(
          backgroundColor: SqColors.background,
          appBar: SessionHeaderWrapper(
            clientCode: consultation.clientCode,
            topicSlug: consultation.topicSlug,
            remaining: state.remaining,
            actions: [
              IconButton(
                key: const Key('sq-session-note'),
                icon: const Icon(Icons.note_alt_outlined),
                onPressed: _openNote,
              ),
              if (state.canSend)
                IconButton(
                  key: const Key('sq-session-complete'),
                  icon: const Icon(Icons.check_circle_outline),
                  onPressed: _openOutcomeSheet,
                ),
            ],
          ),
          body: Column(
            children: [
              Expanded(
                child: ListView.builder(
                  key: const Key('sq-chat-messages'),
                  controller: _scroll,
                  padding: const EdgeInsets.all(16),
                  itemCount: state.messages.length,
                  itemBuilder: (context, index) {
                    final message = state.messages[index];
                    final mine = message.senderRole == 'expert';
                    return Align(
                      alignment: mine
                          ? Alignment.centerRight
                          : Alignment.centerLeft,
                      child: Container(
                        margin: const EdgeInsets.symmetric(vertical: 4),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: mine
                              ? SqColors.primary
                              : SqColors.surfaceMuted,
                          borderRadius: BorderRadius.circular(SqRadius.m),
                        ),
                        child: Text(
                          message.text,
                          style: SqTypography.body.copyWith(
                            color: mine ? Colors.white : SqColors.textPrimary,
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
              if (state.canSend)
                SafeArea(
                  top: false,
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        Expanded(
                          child: TextField(
                            key: const Key('sq-chat-input'),
                            controller: _input,
                            onSubmitted: (_) => _send(),
                          ),
                        ),
                        IconButton(
                          key: const Key('sq-chat-send'),
                          icon: const Icon(Icons.send),
                          onPressed: _send,
                        ),
                      ],
                    ),
                  ),
                )
              else
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    l10n.consultationFinished,
                    style: SqTypography.body.copyWith(
                      color: SqColors.textSecondary,
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}
