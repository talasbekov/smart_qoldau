/// Шапка веб-версии клиента.
///
/// По прототипам `SmartQoldau Web - Каталог` и лендингу: логотип слева,
/// разделы и заметная кнопка «Мне нужна помощь» справа. На телефоне
/// шапки нет вовсе — там нижняя навигация, которая никуда не делась.
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';

/// Разделы шапки.
///
/// Прототип показывает каталог, материалы и Premium — он нарисован для
/// незалогиненного посетителя, у которого справа «Войти». Но в
/// приложении шапка заменяет собой нижнюю навигацию, и без «Консультаций»
/// с «Профилем» человек на десктопе просто теряет к ним доступ. Добавлены
/// они, а не что-то ещё: ровно то, что было в нижней навигации.
enum WebSection { catalog, materials, premium, consultations, profile }

class WebHeader extends StatelessWidget {
  const WebHeader({
    super.key,
    required this.child,
    required this.onHelp,
    required this.onSection,
  });

  final Widget child;
  final VoidCallback onHelp;
  final ValueChanged<WebSection> onSection;

  @override
  Widget build(BuildContext context) {
    if (!SqLayoutScope.of(context).isWide) return child;

    final l10n = AppLocalizations.of(context)!;

    return Column(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(
            horizontal: SqSpacing.l,
            vertical: SqSpacing.m,
          ),
          decoration: const BoxDecoration(
            color: SqColors.surface,
            border: Border(bottom: BorderSide(color: SqColors.border)),
          ),
          child: Row(
            children: [
              Text(
                'SmartQoldau',
                key: const Key('sq-web-logo'),
                style: SqTypography.title.copyWith(color: SqColors.primaryDark),
              ),
              const SizedBox(width: SqSpacing.xl),
              _NavLink(
                id: 'catalog',
                label: l10n.navCatalog,
                onTap: () => onSection(WebSection.catalog),
              ),
              _NavLink(
                id: 'materials',
                label: l10n.navMaterials,
                onTap: () => onSection(WebSection.materials),
              ),
              _NavLink(
                id: 'premium',
                label: l10n.premiumTitle,
                onTap: () => onSection(WebSection.premium),
              ),
              _NavLink(
                id: 'consultations',
                label: l10n.navConsultations,
                onTap: () => onSection(WebSection.consultations),
              ),
              _NavLink(
                id: 'profile',
                label: l10n.navProfile,
                onTap: () => onSection(WebSection.profile),
              ),
              const Spacer(),
              // «Мне нужна помощь» — главное действие всей поверхности:
              // человек, которому плохо, не должен искать его глазами.
              // Ширина меньше на планшете: пять разделов и кнопка в 220 px
              // в 1280 не помещаются, а резать нужно кнопку, а не
              // навигацию.
              SizedBox(
                width: SqLayoutScope.of(context) == SqLayout.desktop
                    ? 220
                    : 170,
                child: SqButton(
                  key: const Key('sq-web-cta-help'),
                  label: l10n.homeEmergencyCta,
                  onPressed: onHelp,
                ),
              ),
            ],
          ),
        ),
        Expanded(child: child),
      ],
    );
  }
}

class _NavLink extends StatelessWidget {
  const _NavLink({required this.id, required this.label, required this.onTap});

  final String id;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: SqSpacing.s),
      child: TextButton(
        key: Key('sq-web-nav-$id'),
        onPressed: onTap,
        child: Text(
          label,
          style: SqTypography.body.copyWith(color: SqColors.textPrimary),
        ),
      ),
    );
  }
}
