/// Список активных офферов эксперта (E7 задача 12) — раздел «Заявки»
/// `ExpertConsultationsScreen`. Каждая карточка — свой обратный отсчёт до
/// `deadlineAt` (тот же экран, что и полноэкранный алерт `IncomingOfferScreen`
/// задачи 11, но списком: несколько офферов могут ждать ответа одновременно).
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/route_paths.dart';
import '../../../l10n/app_localizations.dart';
import '../data/offers_repository.dart';

class OffersListScreen extends StatelessWidget {
  const OffersListScreen({
    super.key,
    required this.offers,
    required this.onRefresh,
  });

  final AsyncValue<List<OfferDto>> offers;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return offers.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(
        child: Text(
          error is ApiException ? error.message : l10n.errorLoadFailed,
          style: SqTypography.body.copyWith(color: SqColors.danger),
        ),
      ),
      data: (list) {
        if (list.isEmpty) {
          return Center(
            child: Text(l10n.offersEmpty, style: SqTypography.body),
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: list.length,
          separatorBuilder: (_, _) => const SizedBox(height: 12),
          itemBuilder: (context, index) =>
              _OfferTile(offer: list[index], onHandled: onRefresh),
        );
      },
    );
  }
}

class _OfferTile extends ConsumerStatefulWidget {
  const _OfferTile({required this.offer, required this.onHandled});

  final OfferDto offer;
  final VoidCallback onHandled;

  @override
  ConsumerState<_OfferTile> createState() => _OfferTileState();
}

class _OfferTileState extends ConsumerState<_OfferTile> {
  Timer? _ticker;
  Duration _remaining = Duration.zero;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _tick();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
  }

  void _tick() {
    final remaining = widget.offer.deadlineAt.difference(DateTime.now());
    if (!mounted) return;
    setState(() => _remaining = remaining.isNegative ? Duration.zero : remaining);
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  static const _expectedOfferErrorCodes = {
    ApiErrorCode.offerExpired,
    ApiErrorCode.offerAlreadyTaken,
    ApiErrorCode.offerNotFound,
    ApiErrorCode.expertBusy,
  };

  /// Показывает ошибку, только если код не входит в ожидаемые
  /// «оффер уже недоступен» — те молча уводят карточку через
  /// `onHandled`-перечитывание списка. Всё остальное (401, 500, обрыв сети)
  /// не должно тонуть незаметно для эксперта.
  void _reportUnexpected(ApiException error) {
    if (_expectedOfferErrorCodes.contains(error.code)) return;
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
  }

  Future<void> _decline() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await ref.read(offersRepositoryProvider).decline(widget.offer.offerId);
    } on ApiException catch (e) {
      _reportUnexpected(e);
    } finally {
      if (mounted) setState(() => _busy = false);
      widget.onHandled();
    }
  }

  Future<void> _accept() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final result = await ref.read(offersRepositoryProvider).accept(widget.offer.offerId);
      if (mounted) context.push(RoutePaths.session(result.consultationId));
    } on ApiException catch (e) {
      _reportUnexpected(e);
    } finally {
      if (mounted) setState(() => _busy = false);
      widget.onHandled();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final offer = widget.offer;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: SqColors.surface,
        borderRadius: BorderRadius.circular(SqRadius.m),
        border: Border.all(color: SqColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(offer.topicSlug, style: SqTypography.title),
              Text(
                l10n.secondsShort(_remaining.inSeconds),
                key: Key('sq-offer-countdown-${offer.offerId}'),
                style: SqTypography.body.copyWith(color: SqColors.textSecondary),
              ),
            ],
          ),
          if (offer.isEmergency)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                l10n.offerEmergencyBadge,
                style: SqTypography.caption.copyWith(color: SqColors.danger),
              ),
            ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  key: Key('sq-offer-decline-${offer.offerId}'),
                  onPressed: _busy ? null : _decline,
                  child: Text(l10n.actionDecline),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  key: Key('sq-offer-accept-${offer.offerId}'),
                  onPressed: _busy ? null : _accept,
                  child: Text(l10n.actionAccept),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
