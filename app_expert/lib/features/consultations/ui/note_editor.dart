/// Приватная заметка эксперта к консультации (E7 задача 13). Не используйте
/// медицинские диагнозы — то же предупреждение, что у бэкенда
/// (`NotesController`).
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';
import '../data/expert_notes_repository.dart';

class NoteEditor extends ConsumerStatefulWidget {
  const NoteEditor({super.key, required this.consultationId});

  final String consultationId;

  @override
  ConsumerState<NoteEditor> createState() => _NoteEditorState();
}

class _NoteEditorState extends ConsumerState<NoteEditor> {
  final _controller = TextEditingController();
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final note = await ref
          .read(expertNotesRepositoryProvider)
          .note(widget.consultationId);
      if (!mounted) return;
      _controller.text = note.text ?? '';
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _saving) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref
          .read(expertNotesRepositoryProvider)
          .saveNote(widget.consultationId, text);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    final l10n = AppLocalizations.of(context)!;

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(l10n.noteEditorTitle, style: SqTypography.title),
          const SizedBox(height: 4),
          Text(
            l10n.noteEditorHint,
            style: SqTypography.caption.copyWith(color: SqColors.textSecondary),
          ),
          const SizedBox(height: 12),
          TextField(
            key: const Key('sq-note-text'),
            controller: _controller,
            maxLines: 6,
            maxLength: 5000,
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                _error!,
                style: SqTypography.body.copyWith(color: SqColors.danger),
              ),
            ),
          ElevatedButton(
            key: const Key('sq-note-save'),
            onPressed: _saving ? null : _save,
            child: Text(l10n.actionSave),
          ),
        ],
      ),
    );
  }
}
