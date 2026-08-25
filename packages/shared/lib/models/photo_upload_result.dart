import 'package:freezed_annotation/freezed_annotation.dart';

import 'enums.dart';

part 'photo_upload_result.freezed.dart';
part 'photo_upload_result.g.dart';

/// Результат `POST /experts/me/photo` (`PhotoUploadedDto` бэкенда) — фото
/// принято на проверку, а не опубликовано сразу: публикация только после
/// решения оператора (см. `photo.service.ts`). Сама ссылка на фото сюда не
/// входит — актуальный `photoUrl` эксперт получает из [ExpertMe.photoUrl]
/// при следующем `me()`.
@freezed
abstract class PhotoUploadedDto with _$PhotoUploadedDto {
  const factory PhotoUploadedDto({
    required ProfileFieldStatus status,
  }) = _PhotoUploadedDto;

  factory PhotoUploadedDto.fromJson(Map<String, dynamic> json) =>
      _$PhotoUploadedDtoFromJson(json);
}
