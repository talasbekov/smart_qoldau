// Виджет-тесты плеера медитаций и музыки (E13): ссылка берётся у сервера,
// отказ по подписке объясняется словами.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_client/core/route_paths.dart';
import 'package:app_client/features/content/state/audio_port.dart';
import 'package:app_client/features/content/ui/player_screen.dart';
import 'package:app_client/l10n/app_localizations.dart';

class MockSqApi extends Mock implements SqApi {}

/// Плеер без нативного слоя: виджет-тест проверяет поведение экрана, а не
/// работу аудиодвижка.
class FakeAudioPort implements AudioPort {
  final played = <String>[];
  bool paused = false;

  @override
  Future<void> play(String url) async => played.add(url);

  @override
  Future<void> pause() async => paused = true;

  @override
  Future<void> dispose() async {}
}

ContentItem _meditation() => const ContentItem(
  id: 'c3',
  kind: ContentKind.meditation,
  access: ContentAccess.premium,
  slug: 'deep-sleep',
  category: 'sleep',
  title: 'Глубокий сон',
  summary: '20 минут',
  durationSec: 1200,
);

Widget _wrap(SqApi api, AudioPort audio) {
  final router = GoRouter(
    initialLocation: '/host',
    routes: [
      GoRoute(
        path: '/host',
        builder: (context, state) => const PlayerScreen(id: 'c3'),
      ),
      GoRoute(
        path: RoutePaths.premium,
        builder: (context, state) =>
            const Scaffold(body: Text('sq-stub-premium')),
      ),
    ],
  );
  addTearDown(router.dispose);

  return ProviderScope(
    overrides: [
      sqApiProvider.overrideWithValue(api),
      audioPortProvider.overrideWithValue(audio),
    ],
    child: MaterialApp.router(
      routerConfig: router,
      locale: const Locale('ru'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
    ),
  );
}

void main() {
  late MockSqApi api;
  late FakeAudioPort audio;

  setUp(() {
    api = MockSqApi();
    audio = FakeAudioPort();
    when(() => api.contentItem('c3')).thenAnswer((_) async => _meditation());
    when(() => api.saveContentProgress(any(), any())).thenAnswer(
      (_) async => const ContentProgress(positionPermille: 0, completed: false),
    );
  });

  testWidgets('ссылка берётся у сервера и уходит в плеер', (tester) async {
    when(() => api.contentMedia('c3')).thenAnswer(
      (_) async => ContentMedia(
        url: 'https://s3.local/a.mp3?X-Amz-Expires=900',
        expiresAt: DateTime.now().add(const Duration(minutes: 15)),
      ),
    );

    await tester.pumpWidget(_wrap(api, audio));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('sq-player-play')));
    await tester.pumpAndSettle();

    expect(audio.played.single, contains('a.mp3'));
    verify(() => api.contentMedia('c3')).called(1);
  });

  testWidgets('403 PREMIUM_REQUIRED объясняется и ведёт на подписку', (
    tester,
  ) async {
    when(() => api.contentMedia('c3')).thenThrow(
      const ApiException(
        ApiErrorCode.premiumRequired,
        'Материал доступен по подписке Premium',
        403,
      ),
    );

    await tester.pumpWidget(_wrap(api, audio));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('sq-player-play')));
    await tester.pumpAndSettle();

    // Ничего не проигралось, человеку объяснили почему и предложили выход.
    expect(audio.played, isEmpty);
    expect(find.byKey(const Key('sq-player-premium')), findsOneWidget);

    await tester.tap(find.byKey(const Key('sq-player-premium')));
    await tester.pumpAndSettle();
    expect(find.text('sq-stub-premium'), findsOneWidget);
  });
}
