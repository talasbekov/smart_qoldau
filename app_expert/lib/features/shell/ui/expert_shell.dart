/// Оболочка кабинета эксперта.
///
/// На широком экране — тёмный сайдбар слева, как в прототипе
/// `docs/Прототип/SmartQoldau Expert Web - Главная.dc.html`: 260 px,
/// фон `#0f3f3a` (это `SqColors.primaryDark` нашей дизайн-системы —
/// прототип на ней и построен), разделы с иконкой и подписью, активный
/// подсвечен полупрозрачным белым.
///
/// На телефоне оболочка не вмешивается: отдаёт содержимое как есть, и
/// мобильное приложение остаётся ровно таким, каким было до E14.
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/route_paths.dart';
import '../../../l10n/app_localizations.dart';

/// Ширины из прототипа: развёрнутый сайдбар 260 px. На планшете подписи
/// съедали бы треть экрана, поэтому там остаются только иконки.
const double _sidebarWidthExpanded = 260;
const double _sidebarWidthCompact = 76;

class _Section {
  const _Section(this.id, this.path, this.icon);

  final String id;
  final String path;
  final IconData icon;
}

/// Разделы, у которых есть экраны. «Клиенты», «Чаты», «Поддержка» и
/// «Настройки» из прототипа сюда не входят — см. расхождение №10 в
/// `brain/WIKI/Расхождения в прототипе.md`: пункт меню, ведущий в «скоро
/// будет», обещает функциональность, которой нет.
const _sections = <_Section>[
  _Section('offers', RoutePaths.offers, Icons.inbox_outlined),
  _Section('consultations', RoutePaths.consultations, Icons.forum_outlined),
  _Section('schedule', RoutePaths.schedule, Icons.calendar_today_outlined),
  _Section('earnings', RoutePaths.earnings, Icons.payments_outlined),
  _Section('reviews', RoutePaths.reviews, Icons.star_border),
];

const _serviceSections = <_Section>[
  _Section('notifications', RoutePaths.notifications, Icons.notifications_none),
  _Section('support', RoutePaths.support, Icons.support_agent_outlined),
  _Section('profile', RoutePaths.profile, Icons.person_outline),
];

class ExpertShell extends StatelessWidget {
  const ExpertShell({super.key, required this.child});

  final Widget child;

  String _label(AppLocalizations l10n, String id) {
    switch (id) {
      // Названия берём из уже существующих строк экранов — новых ключей
      // локализации ради меню не заводим, иначе одно и то же слово
      // начинает жить в двух местах и расходится.
      case 'offers':
        return l10n.offersScreenTitle;
      case 'consultations':
        return l10n.homeNavConsultations;
      case 'schedule':
        return l10n.scheduleScreenTitle;
      case 'earnings':
        return l10n.earningsScreenTitle;
      case 'reviews':
        return l10n.reviewsScreenTitle;
      case 'notifications':
        return l10n.notificationsScreenTitle;
      case 'support':
        return l10n.supportTitle;
      default:
        return l10n.profileScreenTitle;
    }
  }

  @override
  Widget build(BuildContext context) {
    final layout = SqLayoutScope.of(context);
    // Телефон — прежнее приложение, без вмешательства оболочки.
    if (!layout.isWide) return child;

    final expanded = layout == SqLayout.desktop;
    final l10n = AppLocalizations.of(context)!;
    final current = GoRouterState.of(context).uri.path;

    return Scaffold(
      backgroundColor: SqColors.background,
      body: Row(
        children: [
          SizedBox(
            key: const Key('sq-expert-sidebar'),
            width: expanded ? _sidebarWidthExpanded : _sidebarWidthCompact,
            child: Container(
              color: SqColors.primaryDark,
              padding: EdgeInsets.symmetric(
                horizontal: expanded ? 18 : 12,
                vertical: 28,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _Wordmark(expanded: expanded),
                  const SizedBox(height: SqSpacing.l),
                  for (final section in _sections)
                    _NavItem(
                      section: section,
                      label: _label(l10n, section.id),
                      expanded: expanded,
                      active: current.startsWith(section.path),
                    ),
                  const Spacer(),
                  for (final section in _serviceSections)
                    _NavItem(
                      section: section,
                      label: _label(l10n, section.id),
                      expanded: expanded,
                      active: current.startsWith(section.path),
                    ),
                ],
              ),
            ),
          ),
          Expanded(child: child),
        ],
      ),
    );
  }
}

class _Wordmark extends StatelessWidget {
  const _Wordmark({required this.expanded});

  final bool expanded;

  @override
  Widget build(BuildContext context) {
    if (!expanded) {
      return const Icon(Icons.psychology_outlined, color: Colors.white);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'SmartQoldau',
          style: SqTypography.title.copyWith(color: Colors.white),
        ),
        Text(
          'EXPERT',
          // Мятный акцент прототипа на слове EXPERT: единственный цвет
          // оттуда, которого не было в токенах.
          style: SqTypography.caption.copyWith(
            color: const Color(0xFF7FD6C2),
            fontWeight: FontWeight.w700,
            letterSpacing: 0.5,
          ),
        ),
      ],
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.section,
    required this.label,
    required this.expanded,
    required this.active,
  });

  final _Section section;
  final String label;
  final bool expanded;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final content = Row(
      mainAxisAlignment: expanded
          ? MainAxisAlignment.start
          : MainAxisAlignment.center,
      children: [
        Icon(
          section.icon,
          size: 18,
          color: active ? Colors.white : Colors.white70,
        ),
        if (expanded) ...[
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: SqTypography.body.copyWith(
                color: active ? Colors.white : Colors.white70,
                fontWeight: FontWeight.w700,
                fontSize: 13.5,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ],
    );

    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Material(
        color: active
            ? Colors.white.withValues(alpha: 0.08)
            : Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          key: Key(
            active ? 'sq-nav-${section.id}-active' : 'sq-nav-${section.id}',
          ),
          borderRadius: BorderRadius.circular(12),
          onTap: () => context.go(section.path),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
            child: content,
          ),
        ),
      ),
    );
  }
}
