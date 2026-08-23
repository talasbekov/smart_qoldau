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
  }) =>
      guard(() async {
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
            .map(
              (e) => ClientConsultation.fromJson(e as Map<String, dynamic>),
            )
            .toList();
      });

  /// `GET /consultations/{id}` — консультация клиента-участника.
  Future<ClientConsultation> consultationById(String id) => guard(() async {
        final response = await dio.get<Map<String, dynamic>>(
          SqEndpoints.consultationById(id),
        );
        return ClientConsultation.fromJson(response.data!);
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
  }) =>
      guard(() async {
        final response = await dio.get<Map<String, dynamic>>(
          SqEndpoints.consultationMessages(id),
          queryParameters: {
            'cursor': ?cursor,
            'limit': ?limit,
          },
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
  }) =>
      guard(() async {
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
  }) =>
      guard(() async {
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

  /// `DELETE /reviews/{id}` — удаление своего отзыва.
  Future<void> deleteReview(String id) => guard(() async {
        await dio.delete<void>(SqEndpoints.reviewById(id));
      });
}
