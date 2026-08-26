/// Оценка консультации: звёзды, публичный и приватный отзывы.
library;

import 'dart:developer' as developer;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../core/locale_controller.dart';
import '../../funnel/data/requests_repository.dart';
import '../data/reviews_repository.dart';

enum ReviewPhase { editing, sending, sent, alreadyExists }

/// Ключ «оценку по этой консультации уже показывали» — оценка предлагается
/// один раз (бриф задачи 15).
String reviewedFlagKey(String consultationId) => 'sq.reviewed.$consultationId';

/// Ключ с идентификатором оставленного отзыва: он нужен, чтобы отзыв можно
/// было удалить (`DELETE /reviews/{id}`, ТЗ §5.7), а эндпоинта «мой отзыв
/// по консультации» у бэкенда нет. Ограничение известно: при переустановке
/// приложения связь теряется.
String reviewIdKey(String consultationId) => 'sq.reviewId.$consultationId';

class ReviewState {
  const ReviewState({
    this.rating = 0,
    this.publicText = '',
    this.privateText = '',
    this.tags = const [],
    this.phase = ReviewPhase.editing,
    this.errorCode,
  });

  /// 0 — оценка не выбрана; отправлять нечего (звёзды обязательны).
  final int rating;

  final String publicText;
  final String privateText;

  /// Выбранные коды тегов; набор зависит от [rating] и сбрасывается при
  /// его смене.
  final List<String> tags;
  final ReviewPhase phase;
  final String? errorCode;

  bool get canSubmit => rating > 0 && phase == ReviewPhase.editing;

  ReviewState copyWith({
    int? rating,
    String? publicText,
    String? privateText,
    List<String>? tags,
    ReviewPhase? phase,
    String? errorCode,
    bool clearError = false,
  }) => ReviewState(
    rating: rating ?? this.rating,
    publicText: publicText ?? this.publicText,
    privateText: privateText ?? this.privateText,
    tags: tags ?? this.tags,
    phase: phase ?? this.phase,
    errorCode: clearError ? null : (errorCode ?? this.errorCode),
  );
}

class ReviewController extends AutoDisposeFamilyNotifier<ReviewState, String> {
  @override
  ReviewState build(String arg) => const ReviewState();

  /// Смена оценки снимает выбранные теги: набор четвёрки бессмысленен при
  /// единице, и оставленный выбор бэкенд всё равно отверг бы.
  void setRating(int rating) =>
      state = state.copyWith(rating: rating, tags: const [], clearError: true);

  /// Повторный тап снимает выбор; больше [maxReviewTags] выбрать нельзя.
  void toggleTag(String code) {
    if (state.tags.contains(code)) {
      state = state.copyWith(
        tags: state.tags.where((tag) => tag != code).toList(),
      );
      return;
    }
    if (state.tags.length >= maxReviewTags) return;
    state = state.copyWith(tags: [...state.tags, code]);
  }

  void setPublicText(String value) => state = state.copyWith(publicText: value);

  void setPrivateText(String value) =>
      state = state.copyWith(privateText: value);

  /// Отправляет отзыв. Повторный вызов, пока запрос в полёте, игнорируется:
  /// два отзыва об одной консультации бэкенд всё равно не примет
  /// (`REVIEW_EXISTS`), а клиент увидел бы ложную ошибку на собственный
  /// второй тап.
  Future<void> submit() async {
    if (!state.canSubmit) return;
    state = state.copyWith(phase: ReviewPhase.sending, clearError: true);

    try {
      final review = await ref
          .read(reviewsRepositoryProvider)
          .create(
            arg,
            rating: state.rating,
            // Пустой текст — это отсутствие текста: пустая строка попала бы
            // в ленту специалиста пустым отзывом.
            publicText: _nullIfBlank(state.publicText),
            privateText: _nullIfBlank(state.privateText),
            tags: state.tags.isEmpty ? null : state.tags,
          );
      await _rememberReviewed(reviewId: review.id);
      ref
          .read(analyticsProvider)
          .track(ReviewSubmitted(consultationId: arg, rating: state.rating));
      state = state.copyWith(phase: ReviewPhase.sent);
    } on ApiException catch (error) {
      if (error.code == ApiErrorCode.reviewExists) {
        // Отзыв уже есть — оценивать нечего, и предлагать это снова тоже.
        await _rememberReviewed();
        state = state.copyWith(phase: ReviewPhase.alreadyExists);
        return;
      }
      developer.log(
        'отзыв не отправлен: ${error.code}',
        name: 'ReviewController',
      );
      state = state.copyWith(phase: ReviewPhase.editing, errorCode: error.code);
    } catch (error) {
      developer.log(
        'отзыв не отправлен: ${error.runtimeType}',
        name: 'ReviewController',
      );
      state = state.copyWith(phase: ReviewPhase.editing);
    }
  }

  /// «Пропустить»: оценку больше не предлагаем, но ничего не отправляем.
  Future<void> skip() => _rememberReviewed();

  /// «Продолжить с тем же психологом» — адресная заявка к нему же
  /// (retention-пункт БП-01 шаг 8). `null` — создать не удалось.
  Future<MatchRequest?> continueWithExpert({
    required String expertId,
    required String topicSlug,
    required SessionFormat format,
  }) async {
    try {
      return await ref
          .read(requestsRepositoryProvider)
          .create(topicSlug: topicSlug, format: format, expertId: expertId);
    } on ApiException catch (error) {
      developer.log(
        'повторная заявка к специалисту не создана: ${error.code}',
        name: 'ReviewController',
      );
      state = state.copyWith(errorCode: error.code);
      return null;
    }
  }

  Future<void> _rememberReviewed({String? reviewId}) async {
    final prefs = ref.read(sharedPreferencesProvider);
    await prefs.setBool(reviewedFlagKey(arg), true);
    if (reviewId != null) await prefs.setString(reviewIdKey(arg), reviewId);
  }

  String? _nullIfBlank(String value) {
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }
}

final reviewControllerProvider = NotifierProvider.autoDispose
    .family<ReviewController, ReviewState, String>(ReviewController.new);
