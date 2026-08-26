// Тесты SqApiContent (E13): списки, карточки, медиа за пейволлом, прогресс.
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:shared/shared.dart';

SqApi _buildApi() => SqApi(
  baseUrl: 'https://api.test.local/v1',
  readTokens: () async => null,
  writeTokens: (_) async {},
  onLogout: () async {},
);

const _articleJson = {
  'id': 'c1',
  'kind': 'ARTICLE',
  'access': 'FREE',
  'slug': 'anxiety-basics',
  'category': 'anxiety',
  'title': 'Как справиться с тревогой',
  'summary': 'Кратко',
  'durationSec': 300,
  'coverUrl': null,
  'locked': false,
  'positionPermille': 250,
  'body': {'markdown': '# Привет'},
  'usefulYes': 10,
  'usefulNo': 1,
};

const _breathingJson = {
  'id': 'c2',
  'kind': 'BREATHING',
  'access': 'FREE',
  'slug': 'box-breathing',
  'category': 'anxiety',
  'title': 'Квадратное дыхание',
  'summary': 'Четыре фазы',
  'locked': false,
  'positionPermille': 0,
  'body': {
    'cycles': 5,
    'phases': [
      {'name': 'Вдох', 'seconds': 4},
      {'name': 'Выдох', 'seconds': 4},
    ],
  },
};

const _lockedJson = {
  'id': 'c3',
  'kind': 'MEDITATION',
  'access': 'PREMIUM',
  'slug': 'deep-sleep',
  'category': 'sleep',
  'title': 'Глубокий сон',
  'summary': '20 минут',
  'durationSec': 1200,
  'locked': true,
  'positionPermille': 0,
};

void main() {
  late SqApi api;
  late DioAdapter dioAdapter;

  setUp(() {
    api = _buildApi();
    dioAdapter = DioAdapter(dio: api.dio);
  });

  test('список разбирает карточки и флаг замка', () async {
    dioAdapter.onGet(
      '/content',
      (s) => s.reply(200, [_articleJson, _lockedJson]),
    );

    final items = await api.content();
    expect(items, hasLength(2));
    expect(items.first.title, 'Как справиться с тревогой');
    expect(items.first.positionPermille, 250);
    expect(items.last.locked, isTrue);
    expect(items.last.access, ContentAccess.premium);
  });

  test('фильтры уходят параметрами запроса', () async {
    dioAdapter.onGet(
      '/content',
      (s) => s.reply(200, [_articleJson]),
      queryParameters: {'kind': 'ARTICLE', 'category': 'anxiety'},
    );

    final items = await api.content(
      kind: ContentKind.article,
      category: 'anxiety',
    );
    expect(items, hasLength(1));
  });

  test('страница запрашивается через take и skip', () async {
    dioAdapter.onGet(
      '/content',
      (s) => s.reply(200, [_articleJson]),
      queryParameters: {'take': 20, 'skip': 20},
    );

    final items = await api.content(take: 20, skip: 20);
    expect(items, hasLength(1));
  });

  test('тело статьи и тело дыхания разбираются в разные типы', () async {
    dioAdapter.onGet('/content/c1', (s) => s.reply(200, _articleJson));
    dioAdapter.onGet('/content/c2', (s) => s.reply(200, _breathingJson));

    final article = await api.contentItem('c1');
    expect(article.body, isA<ArticleBody>());
    expect((article.body! as ArticleBody).markdown, '# Привет');

    final breathing = await api.contentItem('c2');
    expect(breathing.body, isA<BreathingBody>());
    final body = breathing.body! as BreathingBody;
    expect(body.cycles, 5);
    expect(body.phases.first.seconds, 4);
    // Суммарная длительность цикла считается на клиенте: экран показывает
    // её до старта, а сервер такого поля не отдаёт.
    expect(body.cycleSeconds, 8);
  });

  test('403 PREMIUM_REQUIRED прокидывается как premiumRequired', () async {
    dioAdapter.onGet(
      '/content/c3/media',
      (s) => s.reply(403, {
        'error': {
          'code': 'PREMIUM_REQUIRED',
          'message': 'Материал доступен по подписке Premium',
        },
      }),
    );

    expect(
      () => api.contentMedia('c3'),
      throwsA(
        isA<ApiException>().having(
          (e) => e.code,
          'code',
          ApiErrorCode.premiumRequired,
        ),
      ),
    );
  });

  test('медиа отдаёт ссылку и срок её жизни', () async {
    dioAdapter.onGet(
      '/content/c1/media',
      (s) => s.reply(200, {
        'url': 'https://s3.local/sq-content/a.mp3?X-Amz-Expires=900',
        'expiresAt': '2026-08-26T20:00:00.000Z',
      }),
    );

    final media = await api.contentMedia('c1');
    expect(media.url, contains('X-Amz-Expires'));
    expect(media.expiresAt, DateTime.utc(2026, 8, 26, 20));
  });

  test('прогресс и голос уходят телом запроса', () async {
    dioAdapter.onPost(
      '/content/c1/progress',
      (s) => s.reply(200, {'positionPermille': 800, 'completed': false}),
      data: {'positionPermille': 800},
    );
    dioAdapter.onPost(
      '/content/c1/vote',
      (s) => s.reply(200, {'usefulYes': 11, 'usefulNo': 1}),
      data: {'useful': true},
    );

    final progress = await api.saveContentProgress('c1', 800);
    expect(progress.completed, isFalse);

    final vote = await api.voteContent('c1', useful: true);
    expect(vote.usefulYes, 11);
  });

  test('стрик разбирается', () async {
    dioAdapter.onGet(
      '/content/streak',
      (s) => s.reply(200, {
        'currentDays': 6,
        'longestDays': 12,
        'completedCount': 34,
      }),
    );

    final streak = await api.contentStreak();
    expect(streak.currentDays, 6);
    expect(streak.completedCount, 34);
  });
}
