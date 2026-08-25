// Тесты разбора offer.new/offer.revoked в SqEvent (E7 задача 9).
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

void main() {
  group('offer.new', () {
    test('даёт OfferNew с верными полями', () {
      final event = SqEvent.fromRaw('offer.new', {
        'offerId': 'offer-1',
        'topicSlug': 'anxiety-stress',
        'format': 'video',
        'isEmergency': true,
        'clientCode': 4821,
        'deadlineAt': '2026-08-25T10:15:00.000Z',
      });

      expect(event, isA<OfferNew>());
      final offerNew = event as OfferNew;
      expect(offerNew.offerId, 'offer-1');
      expect(offerNew.topicSlug, 'anxiety-stress');
      expect(offerNew.format, SessionFormat.video);
      expect(offerNew.isEmergency, true);
      expect(offerNew.clientCode, 4821);
      expect(offerNew.deadlineAt, DateTime.parse('2026-08-25T10:15:00.000Z'));
    });

    test('без обязательных полей деградирует в UnknownEvent', () {
      final event = SqEvent.fromRaw('offer.new', <String, dynamic>{});
      expect(event, isA<UnknownEvent>());
      expect((event as UnknownEvent).name, 'offer.new');
    });
  });

  group('offer.revoked', () {
    test('даёт OfferRevoked с offerId', () {
      final event = SqEvent.fromRaw('offer.revoked', {'offerId': 'offer-1'});
      expect(event, isA<OfferRevoked>());
      expect((event as OfferRevoked).offerId, 'offer-1');
    });
  });
}
