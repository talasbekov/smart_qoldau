import '../models/models.dart';
import 'sq_api_base.dart';
import 'sq_endpoints.dart';

/// Обращения в поддержку.
mixin SqApiTickets on SqApiBase {
  /// `POST /tickets` — создать обращение в поддержку. [category] — одно из
  /// значений `TicketCategory` бэкенда (набор допустимых значений зависит от
  /// типа автора, сервер сам это проверяет).
  Future<void> createTicket({
    required String category,
    required String subject,
    required String body,
    String? contactEmail,
    String? contactPhone,
    String? relatedConsultationId,
    String? relatedPayoutId,
  }) => guard(() async {
    await dio.post<void>(
      SqEndpoints.tickets,
      data: {
        'category': category,
        'subject': subject,
        'body': body,
        'contactEmail': ?contactEmail,
        'contactPhone': ?contactPhone,
        'relatedConsultationId': ?relatedConsultationId,
        'relatedPayoutId': ?relatedPayoutId,
      },
    );
  });

  /// `GET /tickets` — мои обращения в поддержку.
  Future<List<TicketSummary>> tickets({int? take, int? skip}) =>
      guard(() async {
        final response = await dio.get<List<dynamic>>(
          SqEndpoints.tickets,
          queryParameters: {'take': ?take, 'skip': ?skip},
        );
        return response.data!
            .map((e) => TicketSummary.fromJson(e as Map<String, dynamic>))
            .toList();
      });

  /// `GET /tickets/{id}` — своё обращение с перепиской.
  Future<TicketDetail> ticketById(String id) => guard(() async {
    final response = await dio.get<Map<String, dynamic>>(
      SqEndpoints.ticketById(id),
    );
    return TicketDetail.fromJson(response.data!);
  });
}
