import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import 'app.dart';
import 'core/providers.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    ProviderScope(
      overrides: [
        // `sqApiProvider` — placeholder-провайдер `shared`, реальное
        // построение — `buildSqApi` в `core/providers.dart` (тот же приём,
        // что в `app_client/lib/main.dart`).
        sqApiProvider.overrideWith(buildSqApi),
      ],
      child: const SqExpertApp(),
    ),
  );
}
