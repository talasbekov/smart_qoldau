/// Полноэкранный алерт входящего оффера (E7 задача 11): показывается через
/// `showDialog` поверх текущего маршрута (см. `IncomingOfferAlertPort`),
/// обратный отсчёт до `deadlineAt`, «Принять»/«Отклонить».
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/route_paths.dart';
import '../../../l10n/app_localizations.dart';
import '../data/offers_repository.dart';
import '../state/incoming_offer_controller.dart';

class IncomingOfferScreen extends ConsumerStatefulWidget {
  const IncomingOfferScreen({super.key, required this.offer});

  final OfferNew offer;

  @override
  ConsumerState<IncomingOfferScreen> createState() => _IncomingOfferScreenState();
}

class _IncomingOfferScreenState extends ConsumerState<IncomingOfferScreen> {
  Timer? _ticker;
  Duration _remaining = Duration.zero;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _tick();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
  }

  void _tick() {
    final remaining = widget.offer.deadlineAt.difference(DateTime.now());
    setState(() => _remaining = remaining.isNegative ? Duration.zero : remaining);
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  Future<void> _respond<T>(
    Future<T> Function() action, {
    void Function(T result)? onSuccess,
  }) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await action();
      if (!mounted) return;
      ref.read(incomingOfferControllerProvider.notifier).handledByUser(widget.offer.offerId);
      // Навигация ДО закрытия диалога — `context` этого виджета валиден
      // ровно до `pop()`; после него он в процессе размонтирования.
      onSuccess?.call(result);
      Navigator.of(context, rootNavigator: true).pop();
    } on ApiException catch (e) {
      // OFFER_EXPIRED/OFFER_ALREADY_TAKEN/OFFER_NOT_FOUND/EXPERT_BUSY —
      // оффер уже недоступен (перехвачен другим, истёк, или эксперт
      // только что принял другую заявку); закрываем
      // алерт тем же путём, что и обычный успех — второй попытки тут
      // всё равно быть не может.
      if (!mounted) return;
      ref.read(incomingOfferControllerProvider.notifier).handledByUser(widget.offer.offerId);
      Navigator.of(context, rootNavigator: true).pop();
      if (e.code != ApiErrorCode.offerExpired &&
          e.code != ApiErrorCode.offerAlreadyTaken &&
          e.code != ApiErrorCode.offerNotFound &&
          e.code != ApiErrorCode.expertBusy) {
        setState(() => _error = e.message);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final offer = widget.offer;
    final seconds = _remaining.inSeconds;

    return PopScope(
      canPop: false,
      child: Dialog.fullscreen(
        backgroundColor: SqColors.surface,
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (offer.isEmergency)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    decoration: BoxDecoration(
                      color: SqColors.danger,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(l10n.offerEmergencyBadge, style: const TextStyle(color: Colors.white)),
                  ),
                const SizedBox(height: 16),
                Text(l10n.offerNewTitle, style: SqTypography.h2),
                const SizedBox(height: 8),
                Text(offer.topicSlug, style: SqTypography.body),
                const SizedBox(height: 24),
                Text(
                  l10n.secondsShort(seconds),
                  key: const Key('sq-offer-countdown'),
                  style: SqTypography.h1,
                ),
                const SizedBox(height: 24),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Text(_error!, style: SqTypography.body.copyWith(color: SqColors.danger)),
                  ),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        key: const Key('sq-offer-decline'),
                        onPressed: _busy
                            ? null
                            : () => _respond(
                                  () => ref.read(offersRepositoryProvider).decline(offer.offerId),
                                ),
                        child: Text(l10n.actionDecline),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: ElevatedButton(
                        key: const Key('sq-offer-accept'),
                        onPressed: _busy
                            ? null
                            : () => _respond(
                                  () => ref.read(offersRepositoryProvider).accept(offer.offerId),
                                  onSuccess: (result) =>
                                      context.push(RoutePaths.session(result.consultationId)),
                                ),
                        child: Text(l10n.actionAccept),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
