/// Заглушка вкладки «Каталог» — список экспертов и фильтры добавит задача 16
/// эпика E6 (`CatalogController`, `ExpertScreen`, `FavoritesController`).
/// Оформлена как явная заглушка ([SqEmptyState] с формулировкой «раздел в
/// разработке»), а не как имитация пустого списка — задача 7 не должна
/// выглядеть так, будто каталог уже готов, но пуст.
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';

class CatalogScreen extends StatelessWidget {
  const CatalogScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(title: Text(l10n.navCatalog)),
      body: Center(
        child: SqEmptyState(
          icon: Icons.construction_outlined,
          title: l10n.navCatalog,
          subtitle: l10n.stubSectionSubtitle,
        ),
      ),
    );
  }
}
