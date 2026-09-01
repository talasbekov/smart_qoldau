import 'package:dio/dio.dart';

import '../models/models.dart';
import 'sq_api_base.dart';
import 'sq_endpoints.dart';

/// Профиль текущего эксперта и управление им.
mixin SqApiExpertProfile on SqApiBase {
  /// `POST /experts` — создать профиль эксперта.
  Future<ExpertMe> createExpert({
    required String displayName,
    required String city,
    required ExperienceLevel experience,
    required String education,
    required int priceTiyn,
    required List<String> languages,
    required List<SessionFormat> formats,
    required List<String> topicSlugs,
  }) => guard(() async {
    final response = await dio.post<Map<String, dynamic>>(
      SqEndpoints.experts,
      data: {
        'displayName': displayName,
        'city': city,
        'experience': experience.wireValue,
        'education': education,
        'priceTiyn': priceTiyn,
        'languages': languages,
        'formats': formats.map((f) => f.wireValue).toList(),
        'topicSlugs': topicSlugs,
      },
    );
    return ExpertMe.fromJson(response.data!);
  });

  /// `GET /experts/me` — получить профиль текущего эксперта.
  Future<ExpertMe> me() => guard(() async {
    final response = await dio.get<Map<String, dynamic>>(SqEndpoints.expertsMe);
    return ExpertMe.fromJson(response.data!);
  });

  /// `PATCH /experts/me` — обновить профиль эксперта.
  Future<ExpertMe> updateExpert({
    String? displayName,
    String? city,
    ExperienceLevel? experience,
    String? education,
    int? priceTiyn,
    List<String>? languages,
    List<SessionFormat>? formats,
    List<String>? topicSlugs,
    String? about,
  }) => guard(() async {
    final data = <String, dynamic>{};
    if (displayName != null) data['displayName'] = displayName;
    if (city != null) data['city'] = city;
    if (experience != null) data['experience'] = experience.wireValue;
    if (education != null) data['education'] = education;
    if (priceTiyn != null) data['priceTiyn'] = priceTiyn;
    if (languages != null) data['languages'] = languages;
    if (formats != null) {
      data['formats'] = formats.map((f) => f.wireValue).toList();
    }
    if (topicSlugs != null) data['topicSlugs'] = topicSlugs;
    if (about != null) data['about'] = about;

    final response = await dio.patch<Map<String, dynamic>>(
      SqEndpoints.expertsMe,
      data: data,
    );
    return ExpertMe.fromJson(response.data!);
  });

  /// `PATCH /experts/me/work-status` — установить статус работы эксперта.
  Future<ExpertMe> setWorkStatus(WorkStatus status) => guard(() async {
    final response = await dio.patch<Map<String, dynamic>>(
      SqEndpoints.expertsMeWorkStatus,
      data: {'status': status.wireValue},
    );
    return ExpertMe.fromJson(response.data!);
  });

  /// `POST /experts/me/heartbeat` — отправить сигнал о доступности эксперта.
  Future<void> heartbeat() => guard(() async {
    await dio.post<void>(SqEndpoints.expertsMeHeartbeat);
  });

  /// `POST /experts/me/photo` — загрузить фото профиля (multipart, поле
  /// `file`) на модерацию. `400 PHOTO_INVALID` — файл пуст,
  /// не то соотношение сторон/формат (см. `PhotoService` бэкенда);
  /// `413 FILE_TOO_LARGE` — больше 5 МБ (загрузку обрывает сам сервер). В
  /// отличие от [SqApiDocuments.uploadDocument] клиент размер заранее не
  /// проверяет — лимит там мельче (5 МБ), а сам ответ бэкенда на невалидный
  /// файл приходит быстро (изображения обычно небольшие), так что
  /// дублировать проверку ради экономии одного round-trip не стоило.
  Future<PhotoUploadedDto> uploadPhoto({
    required List<int> bytes,
    required String filename,
  }) => guard(() async {
    final formData = FormData.fromMap({
      'file': MultipartFile.fromBytes(bytes, filename: filename),
    });
    final response = await dio.post<Map<String, dynamic>>(
      SqEndpoints.expertsMePhoto,
      data: formData,
    );
    return PhotoUploadedDto.fromJson(response.data!);
  });

  /// `DELETE /experts/me/photo` — удалить фото профиля.
  Future<void> deletePhoto() => guard(() async {
    await dio.delete<void>(SqEndpoints.expertsMePhoto);
  });
}
