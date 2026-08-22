/// Медиа-токены LiveKit для аудио/видео консультации.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../../core/providers.dart';

class MediaRepository {
  const MediaRepository(this._api);

  final SqApi _api;

  /// `POST /v1/consultations/{id}/media-token` — токен и адрес комнаты.
  ///
  /// Этим же вызовом делается эскалация формата: бэкенд сам пишет audit и
  /// рассылает `consultation.updated` с новым `format` (см.
  /// `ConsultationsService.issueMediaToken`). [format] — только
  /// `audio`/`video`, `chat` эндпоинт не принимает.
  Future<MediaToken> token(
    String consultationId, {
    required SessionFormat format,
  }) => _api.mediaToken(consultationId, format: format);
}

final mediaRepositoryProvider = Provider<MediaRepository>(
  (ref) => MediaRepository(ref.watch(sqApiProvider)),
);
