/// Заглушка вкладки «Профиль» — гостевой блок конверсии, настройки и
/// поддержку добавит задача 19 эпика E6 (`ProfileScreen`, `SettingsScreen`,
/// `ConvertGuestScreen`). Оформлена как явная заглушка ([SqEmptyState] с
/// формулировкой «раздел в разработке»), см. `catalog_screen.dart`.
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(title: Text(l10n.navProfile)),
      body: Center(
        child: SqEmptyState(
          icon: Icons.construction_outlined,
          title: l10n.navProfile,
          subtitle: l10n.stubSectionSubtitle,
        ),
      ),
    );
  }
}
