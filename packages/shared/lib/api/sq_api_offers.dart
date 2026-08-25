import '../models/models.dart';
import 'sq_api_base.dart';
import 'sq_endpoints.dart';

/// Офферы эксперта (E7 задача 9): активные PENDING-офферы, принятие и
/// отклонение. `OFFER_NOT_FOUND`/`OFFER_EXPIRED`/`OFFER_ALREADY_TAKEN` —
/// не показываются как «ошибка», а ведут на экран «оффер уже недоступен»
/// (см. брифинг задачи 11) — этот модуль их не гасит, а честно
/// пробрасывает через [ApiException], решение о UI принимает вызывающая
/// сторона.
mixin SqApiOffers on SqApiBase {
  /// `GET /experts/me/offers` — активные PENDING-офферы (без PII клиента).
  Future<List<OfferDto>> myOffers() => guard(() async {
        final response = await dio.get<List<dynamic>>(
          SqEndpoints.expertsMeOffers,
        );
        return response.data!
            .cast<Map<String, dynamic>>()
            .map(OfferDto.fromJson)
            .toList();
      });

  /// `POST /offers/{offerId}/accept` — принять оффер (атомарно на бэкенде).
  Future<AcceptOfferDto> acceptOffer(String offerId) => guard(() async {
        final response = await dio.post<Map<String, dynamic>>(
          SqEndpoints.offerAccept(offerId),
        );
        return AcceptOfferDto.fromJson(response.data!);
      });

  /// `POST /offers/{offerId}/decline` — отклонить оффер, заявка уходит
  /// следующему кандидату (204).
  Future<void> declineOffer(String offerId) => guard(() async {
        await dio.post<void>(SqEndpoints.offerDecline(offerId));
      });
}
