/// Присутствие эксперта в вебе (E14, Р-26).
///
/// В браузере нет data-push с обходом «не беспокоить»: пока вкладка
/// открыта, офферы идут по WebSocket; закрыли — не идут вовсе, остаётся
/// только SMS-добивка (E11a). Отсюда два следствия, и оба здесь.
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';

/// Каким статус должен стать, когда человек уходит со страницы.
/// `null` — менять нечего.
///
/// `BUSY` намеренно не трогаем: консультация может идти в другой вкладке
/// или на телефоне, и снятие статуса посреди сессии сделало бы эксперта
/// «свободным» прямо во время разговора.
WorkStatus? presenceOnLeave(WorkStatus current) =>
    current == WorkStatus.accepting ? WorkStatus.notAccepting : null;

/// Предупреждение о том, как работает присутствие в браузере. Показывается
/// ЗАРАНЕЕ и только когда приём включён: узнавать об этом по потерянным
/// заявкам — худший способ.
class WebPresenceNotice extends StatelessWidget {
  const WebPresenceNotice({super.key, required this.accepting});

  final bool accepting;

  @override
  Widget build(BuildContext context) {
    if (!accepting) return const SizedBox.shrink();
    final l10n = AppLocalizations.of(context)!;

    return Container(
      key: const Key('sq-web-presence-notice'),
      padding: const EdgeInsets.all(SqSpacing.m),
      decoration: BoxDecoration(
        color: SqColors.chipBg,
        borderRadius: BorderRadius.circular(SqRadius.m),
      ),
      child: Row(
        children: [
          const Icon(Icons.info_outline, size: 18, color: SqColors.primary),
          const SizedBox(width: SqSpacing.s),
          Expanded(
            child: Text(
              l10n.webPresenceNotice,
              style: SqTypography.caption.copyWith(color: SqColors.primaryDark),
            ),
          ),
        ],
      ),
    );
  }
}
