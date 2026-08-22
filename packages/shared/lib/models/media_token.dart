import 'package:freezed_annotation/freezed_annotation.dart';

part 'media_token.freezed.dart';
part 'media_token.g.dart';

/// LiveKit-токен для аудио/видео консультации (`MediaTokenResponseDto`).
@freezed
abstract class MediaToken with _$MediaToken {
  const factory MediaToken({
    required String token,
    required String url,
    required String room,
  }) = _MediaToken;

  factory MediaToken.fromJson(Map<String, dynamic> json) =>
      _$MediaTokenFromJson(json);
}
