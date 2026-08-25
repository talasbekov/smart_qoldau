/// Экран фото профиля (E7 задача 6): загрузка (multipart, поле `file`) и
/// удаление. Тот же паттерн выбора файла, что `DocumentsScreen` (задача 5):
/// `FilePicker.pickFile()` из `file_picker` — здесь ограничен
/// [FileType.image], поскольку загружается именно фотография.
library;

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../data/verification_repository.dart';

class PhotoScreen extends ConsumerStatefulWidget {
  const PhotoScreen({super.key});

  @override
  ConsumerState<PhotoScreen> createState() => _PhotoScreenState();
}

class _PhotoScreenState extends ConsumerState<PhotoScreen> {
  bool _busy = false;
  String? _error;
  ProfileFieldStatus? _lastStatus;

  Future<void> _pickAndUpload() async {
    final picked = await FilePicker.pickFile(type: FileType.image);
    if (picked == null) return;
    final bytes = await picked.readAsBytes();

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await ref
          .read(verificationRepositoryProvider)
          .uploadPhoto(bytes: bytes, filename: picked.name);
      if (!mounted) return;
      setState(() => _lastStatus = result.status);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _delete() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(verificationRepositoryProvider).deletePhoto();
      if (!mounted) return;
      setState(() => _lastStatus = ProfileFieldStatus.none);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(title: const Text('Фото профиля')),
      body: Padding(
        padding: const EdgeInsets.all(SqSpacing.l),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_lastStatus != null) ...[
              Text(
                _statusLabel(_lastStatus!),
                style: SqTypography.body.copyWith(color: SqColors.textSecondary),
              ),
              const SizedBox(height: SqSpacing.m),
            ],
            if (_error != null) ...[
              Text(
                _error!,
                style: SqTypography.body.copyWith(color: SqColors.danger),
              ),
              const SizedBox(height: SqSpacing.m),
            ],
            SqButton(
              label: 'Загрузить фото',
              onPressed: _busy ? null : _pickAndUpload,
              loading: _busy,
            ),
            const SizedBox(height: SqSpacing.m),
            SqButton(
              label: 'Удалить фото',
              kind: SqButtonKind.danger,
              onPressed: _busy ? null : _delete,
            ),
          ],
        ),
      ),
    );
  }
}

String _statusLabel(ProfileFieldStatus status) => switch (status) {
  ProfileFieldStatus.none => 'Фото не загружено',
  ProfileFieldStatus.pending => 'Фото отправлено на проверку',
  ProfileFieldStatus.approved => 'Фото одобрено',
  ProfileFieldStatus.rejected => 'Фото отклонено',
};
