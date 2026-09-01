/// Экран документов верификации (E7 задача 5): 4 карточки типа документа,
/// статус-бейдж, кнопка «Отправить на проверку» — активна только когда
/// все 4 типа загружены.
library;

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';
import '../state/documents_controller.dart';

String _typeLabel(AppLocalizations l10n, DocumentType type) => switch (type) {
  DocumentType.identity => l10n.documentTypeIdentity,
  DocumentType.diploma => l10n.documentTypeDiploma,
  DocumentType.certificates => l10n.documentTypeCertificates,
  DocumentType.qualification => l10n.documentTypeQualification,
};

String _statusLabel(AppLocalizations l10n, DocumentStatus? status) =>
    switch (status) {
      null => l10n.documentStatusNotUploaded,
      DocumentStatus.uploaded => l10n.documentStatusUploaded,
      DocumentStatus.approved => l10n.documentStatusApproved,
      DocumentStatus.reuploadRequired => l10n.documentStatusReuploadRequired,
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
        SnackBar(content: Text(AppLocalizations.of(context)!.documentTooLarge)),
      );
    } on ApiException catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final documentsAsync = ref.watch(documentsControllerProvider);
    final controller = ref.read(documentsControllerProvider.notifier);

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(title: Text(l10n.documentsScreenTitle)),
      body: documentsAsync.when(
        loading: () => const SqLoader(),
        error: (error, _) => Center(
          child: SqErrorView(
            text: error is ApiException ? error.message : l10n.errorLoadFailed,
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
              label: l10n.actionSubmitForReview,
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
    final l10n = AppLocalizations.of(context)!;
    final status = document?.status;
    return SqCard(
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_typeLabel(l10n, type), style: SqTypography.title),
                const SizedBox(height: SqSpacing.xs),
                Text(
                  _statusLabel(l10n, status),
                  style: SqTypography.caption.copyWith(
                    color: _statusColor(status),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          SqButton(
            label: status == null ? l10n.actionUpload : l10n.actionReplace,
            kind: SqButtonKind.secondary,
            onPressed: onTap,
          ),
        ],
      ),
    );
  }
}
