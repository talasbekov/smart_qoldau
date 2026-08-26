// Тесты SqApiOffers: офферы эксперта (E7 задача 9).
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:shared/shared.dart';

SqApi _buildApi() => SqApi(
  baseUrl: 'https://api.test.local/v1',
  readTokens: () async => null,
  writeTokens: (_) async {},
  onLogout: () async {},
);

final _offerFixture = {
  'offerId': 'offer-1',
  'topicSlug': 'anxiety-stress',
  'format': 'video',
  'isEmergency': true,
  'clientCode': 4821,
  'deadlineAt': '2026-08-25T10:15:00.000Z',
};

final _acceptOfferFixture = {
  'requestId': 'req-1',
  'status': 'MATCHED',
  'consultationId': 'cons-1',
};

void main() {
  late SqApi api;
  late DioAdapter dioAdapter;

  setUp(() {
    api = _buildApi();
    dioAdapter = DioAdapter(dio: api.dio);
  });

  group('OfferDto and AcceptOfferDto round-trip', () {
    test('OfferDto.fromJson/toJson переносят все поля', () {
      final offer = OfferDto.fromJson(_offerFixture);
      expect(offer.offerId, 'offer-1');
      expect(offer.topicSlug, 'anxiety-stress');
      expect(offer.format, SessionFormat.video);
      expect(offer.isEmergency, true);
      expect(offer.clientCode, 4821);
      expect(offer.deadlineAt, DateTime.parse('2026-08-25T10:15:00.000Z'));

      final json = offer.toJson();
      expect(OfferDto.fromJson(json), offer);
    });

    test('AcceptOfferDto.fromJson/toJson переносят все поля', () {
      final result = AcceptOfferDto.fromJson(_acceptOfferFixture);
      expect(result.requestId, 'req-1');
      expect(result.status, RequestStatus.matched);
      expect(result.consultationId, 'cons-1');

      final json = result.toJson();
      expect(AcceptOfferDto.fromJson(json), result);
    });
  });

  group('SqApiOffers', () {
    test('myOffers() → GET /experts/me/offers', () async {
      dioAdapter.onGet(
        '/experts/me/offers',
        (server) => server.reply(200, [_offerFixture]),
      );

      final offers = await api.myOffers();
      expect(offers, hasLength(1));
      expect(offers.single.offerId, 'offer-1');
    });

    test('acceptOffer() → POST /offers/{offerId}/accept', () async {
      dioAdapter.onPost(
        '/offers/offer-1/accept',
        (server) => server.reply(200, _acceptOfferFixture),
      );

      final result = await api.acceptOffer('offer-1');
      expect(result.consultationId, 'cons-1');
    });

    test(
      'acceptOffer() при 410 пробрасывает ApiException(OFFER_EXPIRED)',
      () async {
        dioAdapter.onPost(
          '/offers/offer-1/accept',
          (server) => server.reply(410, {
            'error': {
              'code': 'OFFER_EXPIRED',
              'message': 'Срок действия оффера истёк',
            },
          }),
        );

        await expectLater(
          api.acceptOffer('offer-1'),
          throwsA(
            isA<ApiException>().having((e) => e.code, 'code', 'OFFER_EXPIRED'),
          ),
        );
      },
    );

    test('declineOffer() → POST /offers/{offerId}/decline', () async {
      dioAdapter.onPost(
        '/offers/offer-1/decline',
        (server) => server.reply(204, null),
      );

      await api.declineOffer('offer-1');
    });
  });
}
