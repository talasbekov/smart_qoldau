/// Статус верификации и фото профиля эксперта: тонкая обёртка над
/// `SqApiExpertProfile` (E7 задача 6). Отдельного эндпоинта «моя
/// верификация» у бэкенда нет — единственный источник статуса
/// (`verificationStatus`/`photoStatus`/`aboutStatus`/`moderationComment`)
/// это `GET /experts/me`.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

class VerificationRepository {
  const VerificationRepository(this._api);

  final SqApi _api;

  /// `GET /experts/me` — единственный источник статуса верификации.
  Future<ExpertMe> me() => _api.me();

  /// `POST /experts/me/photo` — multipart-загрузка фото на модерацию.
  Future<PhotoUploadedDto> uploadPhoto({
    required List<int> bytes,
    required String filename,
  }) => _api.uploadPhoto(bytes: bytes, filename: filename);

  /// `DELETE /experts/me/photo` — удалить фото профиля.
  Future<void> deletePhoto() => _api.deletePhoto();
}

final verificationRepositoryProvider = Provider<VerificationRepository>(
  (ref) => VerificationRepository(ref.watch(sqApiProvider)),
);
