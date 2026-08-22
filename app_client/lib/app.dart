import 'package:flutter/material.dart';

/// Корневой виджет клиентского приложения SmartQoldau.
///
/// Тема пока дефолтная — дизайн-система появится в задаче 2 эпика E6.
class SqClientApp extends StatelessWidget {
  const SqClientApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      title: 'SmartQoldau',
    );
  }
}
