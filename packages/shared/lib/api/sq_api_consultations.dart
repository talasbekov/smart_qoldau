import '../models/models.dart';
import 'sq_api_base.dart';
import 'sq_endpoints.dart';

/// Консультации, медиа-токены и отзывы клиента.
mixin SqApiConsultations on SqApiBase {
  /// `GET /consultations?as=client` — список своих консультаций клиента.
  Future<List<ClientConsultation>> consultations({
    ConsultationStatus? status,
    int? take,
    int? skip,
  }) => guard(() async {
    final response = await dio.get<List<dynamic>>(
      SqEndpoints.consultations,
      queryParameters: {
        'as': 'client',
        if (status != null) 'status': status.wireValue,
        'take': ?take,
        'skip': ?skip,
      },
    );
    return response.data!
        .map((e) => ClientConsultation.fromJson(e as Map<String, dynamic>))
        .toList();
  });

  /// `GET /consultations?as=expert` — список консультаций текущего
  /// эксперта (E7 задача 12). PII-инвариант: `ConsultationExpertDto` несёт
  /// только `clientCode`, без данных клиента.
  Future<List<ConsultationExpertDto>> expertConsultations({
    ConsultationStatus? status,
    int? take,
    int? skip,
  }) => guard(() async {
    final response = await dio.get<List<dynamic>>(
      SqEndpoints.consultations,
      queryParameters: {
        'as': 'expert',
        if (status != null) 'status': status.wireValue,
        'take': ?take,
        'skip': ?skip,
      },
    );
    return response.data!
        .map((e) => ConsultationExpertDto.fromJson(e as Map<String, dynamic>))
        .toList();
  });

  /// `GET /consultations/{id}` — консультация клиента-участника.
  Future<ClientConsultation> consultationById(String id) => guard(() async {
    final response = await dio.get<Map<String, dynamic>>(
      SqEndpoints.consultationById(id),
    );
    return ClientConsultation.fromJson(response.data!);
  });

  /// `GET /consultations/{id}` — консультация, где вызывающий — эксперт-
  /// участник (E7 задача 13). Тот же путь, что [consultationById] — форма
  /// ответа зависит от РОЛИ вызывающего на бэкенде
  /// (`ConsultationsService.findForParticipant`), а не от query-параметра,
  /// поэтому это не дубль, а другой разбор того же эндпоинта.
  /// [consultationById] сознательно не переиспользован здесь: он парсит
  /// ответ как `ClientConsultation` (обязательное поле `expert`), что упало
  /// бы `TypeError` на экспертском ответе (нет `expert`, есть `clientCode`/
  /// `topicSlug`).
  Future<ConsultationExpertDto> expertConsultationById(String id) =>
      guard(() async {
        final response = await dio.get<Map<String, dynamic>>(
          SqEndpoints.consultationById(id),
        );
        return ConsultationExpertDto.fromJson(response.data!);
      });

  /// `POST /consultations/{id}/complete` — эксперт завершает консультацию
  /// с исходом. `403 FORBIDDEN` — не эксперт-участник; `409
  /// CONSULTATION_NOT_ACTIVE` — уже закрыта (гонка с клиентом/no-show);
  /// `409 INVALID_OUTCOME` — `CLIENT_NO_SHOW`, когда клиент по данным
  /// LiveKit подключался (Р-01).
  Future<ConsultationExpertDto> completeConsultation(
    String id,
    ConsultationOutcome outcome,
  ) => guard(() async {
    final response = await dio.post<Map<String, dynamic>>(
      SqEndpoints.consultationComplete(id),
      data: {'outcome': outcome.wireValue},
    );
    return ConsultationExpertDto.fromJson(response.data!);
  });

  /// `POST /consultations/{id}/cancel` — отмена консультации клиентом.
  Future<ClientConsultation> cancelConsultation(String id) => guard(() async {
    final response = await dio.post<Map<String, dynamic>>(
      SqEndpoints.consultationCancel(id),
    );
    return ClientConsultation.fromJson(response.data!);
  });

  /// `GET /consultations/{id}/messages` — история сообщений чата.
  Future<MessageHistory> consultationMessages(
    String id, {
    String? cursor,
    int? limit,
  }) => guard(() async {
    final response = await dio.get<Map<String, dynamic>>(
      SqEndpoints.consultationMessages(id),
      queryParameters: {'cursor': ?cursor, 'limit': ?limit},
    );
    return MessageHistory.fromJson(response.data!);
  });

  /// `POST /consultations/{id}/media-token` — LiveKit-токен для
  /// аудио/видео. `format` — только `audio`/`video` (см.
  /// `MediaTokenRequestDto` бэкенда, `chat` этим эндпоинтом не
  /// поддерживается).
  Future<MediaToken> mediaToken(String id, {required SessionFormat format}) =>
      guard(() async {
        final response = await dio.post<Map<String, dynamic>>(
          SqEndpoints.consultationMediaToken(id),
          data: {'format': format.wireValue},
        );
        return MediaToken.fromJson(response.data!);
      });

  /// `POST /consultations/{id}/pay` — оплата консультации (холд).
  Future<PayResult> payConsultation(
    String id, {
    required String paymentMethodId,
  }) => guard(() async {
    final response = await dio.post<Map<String, dynamic>>(
      SqEndpoints.consultationPay(id),
      data: {'paymentMethodId': paymentMethodId},
    );
    return PayResult.fromJson(response.data!);
  });

  /// `GET /consultations/{id}/payment` — статус платежа консультации.
  Future<PaymentStatusInfo> consultationPayment(String id) => guard(() async {
    final response = await dio.get<Map<String, dynamic>>(
      SqEndpoints.consultationPayment(id),
    );
    return PaymentStatusInfo.fromJson(response.data!);
  });

  /// `POST /consultations/{id}/review` — оставить отзыв на завершённую
  /// консультацию.
  Future<ReviewCreated> createReview(
    String consultationId, {
    required int rating,
    String? publicText,
    String? privateText,
    List<String>? tags,
  }) => guard(() async {
    final response = await dio.post<Map<String, dynamic>>(
      SqEndpoints.consultationReview(consultationId),
      data: {
        'rating': rating,
        'publicText': ?publicText,
        'privateText': ?privateText,
        // Пустой список не отправляем: бэкенд трактует отсутствие поля
        // и пустой массив одинаково, а лишнего в теле быть не должно.
        if (tags != null && tags.isNotEmpty) 'tags': tags,
      },
    );
    return ReviewCreated.fromJson(response.data!);
  });

  /// `GET /experts/{id}/slots` — свободные слоты специалиста (E6b).
  /// Диапазон шире 14 дней бэкенд отклоняет.
  Future<List<Slot>> slots(
    String expertId, {
    required DateTime from,
    required DateTime to,
  }) => guard(() async {
    final response = await dio.get<Map<String, dynamic>>(
      SqEndpoints.expertSlots(expertId),
      queryParameters: {
        'from': from.toUtc().toIso8601String(),
        'to': to.toUtc().toIso8601String(),
      },
    );
    final items = response.data!['items'] as List<dynamic>;
    return items.map((e) => Slot.fromJson(e as Map<String, dynamic>)).toList();
  });

  /// `POST /bookings` — запись на слот. Повторный идентичный запрос
  /// бэкенд отдаёт со статусом 200 и той же записью.
  Future<BookingResult> createBooking({
    required String expertId,
    required String topicSlug,
    required SessionFormat format,
    required DateTime slotStartAt,
    required String paymentMethodId,
  }) => guard(() async {
    final response = await dio.post<Map<String, dynamic>>(
      SqEndpoints.bookings,
      data: {
        'expertId': expertId,
        'topicSlug': topicSlug,
        'format': format.wireValue,
        'slotStartAt': slotStartAt.toUtc().toIso8601String(),
        'paymentMethodId': paymentMethodId,
      },
    );
    return BookingResult.fromJson(response.data!);
  });

  /// `POST /consultations/{id}/reschedule` — перенос плановой записи.
  /// Холд не пересоздаётся, поэтому шторка оплаты здесь не нужна.
  Future<BookingResult> reschedule(
    String consultationId,
    DateTime slotStartAt,
  ) => guard(() async {
    final response = await dio.post<Map<String, dynamic>>(
      SqEndpoints.consultationReschedule(consultationId),
      data: {'slotStartAt': slotStartAt.toUtc().toIso8601String()},
    );
    return BookingResult.fromJson(response.data!);
  });

  /// `DELETE /reviews/{id}` — удаление своего отзыва.
  Future<void> deleteReview(String id) => guard(() async {
    await dio.delete<void>(SqEndpoints.reviewById(id));
  });
}
