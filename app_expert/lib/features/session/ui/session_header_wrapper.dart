/// Шапка сессии эксперта (E7 задача 13) — используется и чатом, и звонком
/// (консультация одна, второй источник тех же данных разошёлся бы с
/// первым, тот же принцип, что `SessionHeader` у клиента). Не показывает
/// имя/телефон клиента — только `clientCode` (PII-инвариант).
library;

import 'package:flutter/material.dart';

class SessionHeaderWrapper extends StatelessWidget implements PreferredSizeWidget {
  const SessionHeaderWrapper({
    super.key,
    required this.clientCode,
    required this.topicSlug,
    required this.remaining,
    this.actions = const [],
  });

  final int clientCode;
  final String topicSlug;
  final Duration remaining;
  final List<Widget> actions;

  String get _remainingLabel {
    final minutes = remaining.inMinutes;
    final seconds = remaining.inSeconds % 60;
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      title: Text('Клиент #$clientCode · $topicSlug'),
      actions: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Center(
            child: Text(_remainingLabel, key: const Key('sq-session-remaining')),
          ),
        ),
        ...actions,
      ],
    );
  }
}
