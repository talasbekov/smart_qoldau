// Тесты SqApiEarnings (E7 задача 14): доход, баланс, выводы.
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:shared/shared.dart';

SqApi _buildApi() => SqApi(
      baseUrl: 'https://api.test.local/v1',
      readTokens: () async => null,
      writeTokens: (_) async {},
      onLogout: () async {},
    );

void main() {
  late SqApi api;
  late DioAdapter dioAdapter;

  setUp(() {
    api = _buildApi();
    dioAdapter = DioAdapter(dio: api.dio);
  });

  group('round-trip моделей', () {
    test('EarningsItemDto/EarningsDto', () {
      final item = EarningsItemDto.fromJson({
        'consultationId': 'cons-1',
        'priceTiyn': 500000,
        'commissionTiyn': 75000,
        'netTiyn': 425000,
        'createdAt': '2026-08-25T10:00:00.000Z',
      });
      expect(item.netTiyn, 425000);
      expect(EarningsItemDto.fromJson(item.toJson()), item);

      final earnings = EarningsDto.fromJson({'balanceTiyn': 1000000, 'items': [item.toJson()]});
      expect(earnings.balanceTiyn, 1000000);
      expect(earnings.items, [item]);
    });

    test('BalanceDto', () {
      final balance = BalanceDto.fromJson({'balanceTiyn': 500000, 'availableTiyn': 500000});
      expect(balance.availableTiyn, 500000);
      expect(BalanceDto.fromJson(balance.toJson()), balance);
    });

    test('PayoutDto', () {
      final payout = PayoutDto.fromJson({
        'id': 'payout-1',
        'amountTiyn': 1000000,
        'maskedPan': '**** 1111',
        'status': 'PENDING_REVIEW',
        'rejectReason': null,
        'createdAt': '2026-08-25T10:00:00.000Z',
      });
      expect(payout.status, PayoutStatus.pendingReview);
      expect(PayoutDto.fromJson(payout.toJson()), payout);
    });
  });

  group('SqApiEarnings', () {
    test('earnings() → GET /experts/me/earnings', () async {
      dioAdapter.onGet(
        '/experts/me/earnings',
        (server) => server.reply(200, {
          'balanceTiyn': 1000000,
          'items': [
            {
              'consultationId': 'cons-1',
              'priceTiyn': 500000,
              'commissionTiyn': 75000,
              'netTiyn': 425000,
              'createdAt': '2026-08-25T10:00:00.000Z',
            },
          ],
        }),
      );

      final result = await api.earnings();
      expect(result.balanceTiyn, 1000000);
      expect(result.items, hasLength(1));
    });

    test('balance() → GET /experts/me/balance', () async {
      dioAdapter.onGet(
        '/experts/me/balance',
        (server) => server.reply(200, {'balanceTiyn': 200000, 'availableTiyn': 200000}),
      );

      final result = await api.balance();
      expect(result.availableTiyn, 200000);
    });

    test('requestPayout() → POST /payouts', () async {
      dioAdapter.onPost(
        '/payouts',
        (server) => server.reply(201, {
          'id': 'payout-1',
          'amountTiyn': 1000000,
          'maskedPan': '**** 1111',
          'status': 'PROCESSING',
          'rejectReason': null,
          'createdAt': '2026-08-25T10:00:00.000Z',
        }),
        data: {
          'amountTiyn': 1000000,
          'pan': '4111111111111111',
          'expiry': '12/28',
          'holderName': 'Ivan Petrov',
        },
      );

      final result = await api.requestPayout(
        amountTiyn: 1000000,
        pan: '4111111111111111',
        expiry: '12/28',
        holderName: 'Ivan Petrov',
      );
      expect(result.status, PayoutStatus.processing);
    });

    test('payouts() → GET /payouts, разбирает обёртку {items: [...]}', () async {
      dioAdapter.onGet(
        '/payouts',
        (server) => server.reply(200, {
          'items': [
            {
              'id': 'payout-1',
              'amountTiyn': 1000000,
              'maskedPan': '**** 1111',
              'status': 'PAID',
              'rejectReason': null,
              'createdAt': '2026-08-25T10:00:00.000Z',
            },
          ],
        }),
      );

      final result = await api.payouts();
      expect(result, hasLength(1));
      expect(result.single.status, PayoutStatus.paid);
    });
  });
}
