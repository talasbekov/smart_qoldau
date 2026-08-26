import 'package:freezed_annotation/freezed_annotation.dart';

part 'content_item.freezed.dart';
part 'content_item.g.dart';

/// Вид материала библиотеки самопомощи (E13).
enum ContentKind {
  @JsonValue('MEDITATION')
  meditation,
  @JsonValue('MUSIC')
  music,
  @JsonValue('ARTICLE')
  article,
  @JsonValue('BREATHING')
  breathing,
}

enum ContentAccess {
  @JsonValue('FREE')
  free,
  @JsonValue('PREMIUM')
  premium,
}

/// Фаза дыхательной техники на языке пользователя.
@freezed
abstract class BreathingPhase with _$BreathingPhase {
  const factory BreathingPhase({required String name, required int seconds}) =
      _BreathingPhase;

  factory BreathingPhase.fromJson(Map<String, dynamic> json) =>
      _$BreathingPhaseFromJson(json);
}

/// Тело материала. У видов оно разное, поэтому разбирается в разные типы —
/// экран не должен гадать, что за поля пришли.
sealed class ContentBody {
  const ContentBody();

  /// Аудио тела не имеет: ссылка выдаётся отдельным запросом, потому что
  /// пейволл стоит именно на ней.
  static ContentBody? fromJson(ContentKind kind, Map<String, dynamic>? json) {
    if (json == null) return null;
    switch (kind) {
      case ContentKind.article:
        return ArticleBody(markdown: json['markdown'] as String? ?? '');
      case ContentKind.breathing:
        return BreathingBody(
          cycles: json['cycles'] as int? ?? 1,
          phases: ((json['phases'] as List<dynamic>?) ?? const [])
              .map((e) => BreathingPhase.fromJson(e as Map<String, dynamic>))
              .toList(),
        );
      case ContentKind.meditation:
      case ContentKind.music:
        return null;
    }
  }
}

class ArticleBody extends ContentBody {
  const ArticleBody({required this.markdown});

  final String markdown;
}

class BreathingBody extends ContentBody {
  const BreathingBody({required this.cycles, required this.phases});

  final int cycles;
  final List<BreathingPhase> phases;

  /// Длительность одного цикла. Считается на клиенте: экран показывает её
  /// до старта, а сервер такого поля не отдаёт.
  int get cycleSeconds => phases.fold(0, (sum, phase) => sum + phase.seconds);
}

/// Карточка материала на языке пользователя (`ContentItemDto` бэкенда).
@freezed
abstract class ContentItem with _$ContentItem {
  const ContentItem._();

  const factory ContentItem({
    required String id,
    required ContentKind kind,
    required ContentAccess access,
    required String slug,
    required String category,
    required String title,
    required String summary,

    /// Материал за подпиской, а подписки нет. Решение о доступе принимает
    /// сервер при выдаче ссылки — это флаг для замка на карточке, не
    /// проверка прав.
    @Default(false) bool locked,
    @Default(0) int positionPermille,
    int? durationSec,
    String? coverUrl,
    int? usefulYes,
    int? usefulNo,
    @JsonKey(includeFromJson: false, includeToJson: false) ContentBody? body,
  }) = _ContentItem;

  factory ContentItem.fromJson(Map<String, dynamic> json) =>
      _$ContentItemFromJson(json).copyWith(
        body: ContentBody.fromJson(
          _$ContentItemFromJson(json).kind,
          json['body'] as Map<String, dynamic>?,
        ),
      );
}

/// Подписанная ссылка на файл материала и срок её жизни.
@freezed
abstract class ContentMedia with _$ContentMedia {
  const factory ContentMedia({
    required String url,
    required DateTime expiresAt,
  }) = _ContentMedia;

  factory ContentMedia.fromJson(Map<String, dynamic> json) =>
      _$ContentMediaFromJson(json);
}

@freezed
abstract class ContentProgress with _$ContentProgress {
  const factory ContentProgress({
    required int positionPermille,
    required bool completed,
  }) = _ContentProgress;

  factory ContentProgress.fromJson(Map<String, dynamic> json) =>
      _$ContentProgressFromJson(json);
}

@freezed
abstract class ContentVotes with _$ContentVotes {
  const factory ContentVotes({required int usefulYes, required int usefulNo}) =
      _ContentVotes;

  factory ContentVotes.fromJson(Map<String, dynamic> json) =>
      _$ContentVotesFromJson(json);
}

/// Стрик практик и счётчик пройденного.
@freezed
abstract class ContentStreak with _$ContentStreak {
  const factory ContentStreak({
    required int currentDays,
    required int longestDays,
    required int completedCount,
  }) = _ContentStreak;

  factory ContentStreak.fromJson(Map<String, dynamic> json) =>
      _$ContentStreakFromJson(json);
}
