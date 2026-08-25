/// Офферы эксперта: тонкая обёртка над `SqApiOffers` (E7 задачи 9/11/12).
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

class OffersRepository {
  const OffersRepository(this._api);

  final SqApi _api;

  /// `GET /experts/me/offers` — активные PENDING-офферы.
  Future<List<OfferDto>> myOffers() => _api.myOffers();

  /// `POST /offers/{offerId}/accept` — принять оффер.
  Future<AcceptOfferDto> accept(String offerId) => _api.acceptOffer(offerId);

  /// `POST /offers/{offerId}/decline` — отклонить оффер.
  Future<void> decline(String offerId) => _api.declineOffer(offerId);
}

final offersRepositoryProvider = Provider<OffersRepository>(
  (ref) => OffersRepository(ref.watch(sqApiProvider)),
);
