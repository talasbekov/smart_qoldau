/// Создание обращения в поддержку.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/route_paths.dart';
import '../../../l10n/app_localizations.dart';
import '../state/tickets_controller.dart';
import 'support_screen.dart' show ticketCategoryLabel;

class NewTicketScreen extends ConsumerStatefulWidget {
  const NewTicketScreen({super.key, this.relatedConsultationId});

  /// Обращение «по этой консультации» — приходит из сессии (задача 13) и
  /// из деталей консультации.
  final String? relatedConsultationId;

  @override
  ConsumerState<NewTicketScreen> createState() => _NewTicketScreenState();
}

class _NewTicketScreenState extends ConsumerState<NewTicketScreen> {
  final _subject = TextEditingController();
  final _body = TextEditingController();

  TicketCategory _category = TicketCategory.other;
  bool _sending = false;
  String? _subjectError;
  String? _bodyError;
  String? _apiError;

  @override
  void dispose() {
    _subject.dispose();
    _body.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context)!;
    final subject = _subject.text.trim();
    final body = _body.text.trim();

    setState(() {
      _apiError = null;
      // Границы бэкенда (`CreateTicketDto`): тема 1..200, текст 1..4000.
      _subjectError = subject.isEmpty || subject.length > 200
          ? l10n.ticketSubjectInvalid
          : null;
      _bodyError = body.length < 10 || body.length > 4000
          ? l10n.ticketBodyInvalid
          : null;
    });
    if (_subjectError != null || _bodyError != null) return;

    setState(() => _sending = true);
    try {
      await ref
          .read(ticketsControllerProvider.notifier)
          .create(
            category: _category,
            subject: subject,
            body: body,
            relatedConsultationId: widget.relatedConsultationId,
          );
      if (!mounted) return;
      context.go(RoutePaths.support);
    } on ApiException catch (error) {
      if (mounted) setState(() => _apiError = error.message);
    } catch (_) {
      if (mounted) {
        setState(() => _apiError = AppLocalizations.of(context)!.errorGeneric);
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(title: Text(l10n.supportNewTicket)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(SqSpacing.l),
          children: [
            Text(l10n.ticketCategoryLabel, style: SqTypography.title),
            const SizedBox(height: SqSpacing.s),
            Wrap(
              spacing: SqSpacing.s,
              runSpacing: SqSpacing.s,
              children: [
                for (final category in expertTicketCategories)
                  GestureDetector(
                    key: Key('sq-ticket-category-${category.name}'),
                    onTap: () => setState(() => _category = category),
                    child: SqChip(
                      label: ticketCategoryLabel(l10n, category),
                      selected: _category == category,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: SqSpacing.l),
            SqTextField(
              key: const Key('sq-ticket-subject'),
              controller: _subject,
              label: l10n.ticketSubjectLabel,
              errorText: _subjectError,
            ),
            const SizedBox(height: SqSpacing.m),
            SqTextField(
              key: const Key('sq-ticket-body'),
              controller: _body,
              label: l10n.ticketBodyLabel,
              errorText: _bodyError,
            ),
            if (_apiError != null) ...[
              const SizedBox(height: SqSpacing.m),
              Text(
                _apiError!,
                key: const Key('sq-ticket-error'),
                style: SqTypography.body.copyWith(color: SqColors.danger),
                textAlign: TextAlign.center,
              ),
            ],
            const SizedBox(height: SqSpacing.xl),
            SqButton(
              key: const Key('sq-ticket-submit'),
              label: l10n.actionSend,
              loading: _sending,
              onPressed: _sending ? null : _submit,
            ),
          ],
        ),
      ),
    );
  }
}
