import 'package:freezed_annotation/freezed_annotation.dart';

part 'auth_models.freezed.dart';
part 'auth_models.g.dart';

/// Пара токенов и профиль пользователя (`TokensDto` бэкенда) — ответ
/// `/auth/verify-code`, `/auth/refresh`, `/auth/guest`, `/auth/guest/convert`.
@freezed
abstract class Tokens with _$Tokens {
  const factory Tokens({
    required String accessToken,
    required String refreshToken,
    required AuthUser user,
  }) = _Tokens;

  factory Tokens.fromJson(Map<String, dynamic> json) => _$TokensFromJson(json);
}

/// Профиль пользователя (`UserDto` бэкенда). `phone` отсутствует у гостя,
/// пока номер не подтверждён (`isGuest == true`).
@freezed
abstract class AuthUser with _$AuthUser {
  const factory AuthUser({
    required String id,
    required String? phone,
    required bool isGuest,
  }) = _AuthUser;

  factory AuthUser.fromJson(Map<String, dynamic> json) =>
      _$AuthUserFromJson(json);
}
