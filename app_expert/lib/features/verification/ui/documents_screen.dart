/// Экран документов верификации (E7 задача 5): 4 карточки типа документа,
/// статус-бейдж, кнопка «Отправить на проверку» — активна только когда
/// все 4 типа загружены.
library;

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../state/documents_controller.dart';

String _typeLabel(DocumentType type) => switch (type) {
  DocumentType.identity => 'Удостоверение личности',
  DocumentType.diploma => 'Диплом об образовании',
  DocumentType.certificates => 'Сертификаты',
  DocumentType.qualification => 'Подтверждение квалификации',
};

String _statusLabel(DocumentStatus? status) => switch (status) {
  null => 'Не загружен',
  DocumentStatus.uploaded => 'На проверке',
  DocumentStatus.approved => 'Принят',
  DocumentStatus.reuploadRequired => 'Нужна переотправка',
};

Color _statusColor(DocumentStatus? status) => switch (status) {
  null => SqColors.textTertiary,
  DocumentStatus.uploaded => SqColors.accent,
  DocumentStatus.approved => SqColors.primary,
  DocumentStatus.reuploadRequired => SqColors.danger,
};

class DocumentsScreen extends ConsumerWidget {
  const DocumentsScreen({super.key});

  Future<void> _pickAndUpload(
    BuildContext context,
    WidgetRef ref,
    DocumentType type,
  ) async {
    final picked = await FilePicker.pickFile();
    if (picked == null) return;
    final bytes = await picked.readAsBytes();

    try {
      await ref
          .read(documentsControllerProvider.notifier)
          .upload(type, bytes: bytes, filename: picked.name);
    } on DocumentTooLargeException {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Файл больше 10 МБ — выберите файл меньшего размера'),
        ),
      );
    } on ApiException catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final documentsAsync = ref.watch(documentsControllerProvider);
    final controller = ref.read(documentsControllerProvider.notifier);

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(title: const Text('Документы верификации')),
      body: documentsAsync.when(
        loading: () => const SqLoader(),
        error: (error, _) => Center(
          child: SqErrorView(
            text: error is ApiException
                ? error.message
                : 'Не удалось загрузить документы',
            onRetry: controller.refresh,
          ),
        ),
        data: (docs) => ListView(
          padding: const EdgeInsets.all(SqSpacing.l),
          children: [
            for (final type in DocumentType.values) ...[
              _DocumentCard(
                type: type,
                document: docs[type],
                onTap: () => _pickAndUpload(context, ref, type),
              ),
              const SizedBox(height: SqSpacing.m),
            ],
            const SizedBox(height: SqSpacing.m),
            SqButton(
              label: 'Отправить на проверку',
              onPressed: controller.canSubmit
                  ? () async {
                      await controller.submit();
                    }
                  : null,
            ),
          ],
        ),
      ),
    );
  }
}

class _DocumentCard extends StatelessWidget {
  const _DocumentCard({
    required this.type,
    required this.document,
    required this.onTap,
  });

  final DocumentType type;
  final ExpertDocumentDto? document;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final status = document?.status;
    return SqCard(
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_typeLabel(type), style: SqTypography.title),
                const SizedBox(height: SqSpacing.xs),
                Text(
                  _statusLabel(status),
                  style: SqTypography.caption.copyWith(
                    color: _statusColor(status),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          SqButton(
            label: status == null ? 'Загрузить' : 'Заменить',
            kind: SqButtonKind.secondary,
            onPressed: onTap,
          ),
        ],
      ),
    );
  }
}
