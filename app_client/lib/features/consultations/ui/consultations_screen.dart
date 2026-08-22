/// Заглушка вкладки «Консультации» — активные/история/отмена добавит
/// задача 17 эпика E6 (`ConsultationsController`, `ConsultationCard`,
/// `ConsultationDetailsScreen`). Оформлена как явная заглушка ([SqEmptyState]
/// с формулировкой «раздел в разработке»), см. `catalog_screen.dart`.
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';

class ConsultationsScreen extends StatelessWidget {
  const ConsultationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(title: Text(l10n.navConsultations)),
      body: Center(
        child: SqEmptyState(
          icon: Icons.construction_outlined,
          title: l10n.navConsultations,
          subtitle: l10n.stubSectionSubtitle,
        ),
      ),
    );
  }
}
