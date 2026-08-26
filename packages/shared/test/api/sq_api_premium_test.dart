// Тесты SqApiPremium (E12): статус подписки, оформление, отмена.
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:shared/shared.dart';

SqApi _buildApi() => SqApi(
      baseUrl: 'https://api.test.local/v1',
      readTokens: () async => null,
      writeTokens: (_) async {},
      onLogout: () async {},
    );

const _activeJson = {
  'active': true,
  'plan': 'MONTH',
  'currentPeriodEnd': '2026-09-26T00:00:00.000Z',
  'cancelled': false,
  'inGrace': false,
};

void main() {
  late SqApi api;
  late DioAdapter dioAdapter;

  setUp(() {
    api = _buildApi();
    dioAdapter = DioAdapter(dio: api.dio);
  });

  test('premiumStatus разбирает ответ бэкенда', () async {
    dioAdapter.onGet('/premium', (s) => s.reply(200, _activeJson));

    final status = await api.premiumStatus();
    expect(status.active, isTrue);
    expect(status.plan, PremiumPlan.month);
    expect(status.cancelled, isFalse);
    expect(status.currentPeriodEnd, DateTime.utc(2026, 9, 26));
  });

  test('без подписки: plan и дата null, active false', () async {
    dioAdapter.onGet(
      '/premium',
      (s) => s.reply(200, {
        'active': false,
        'plan': null,
        'currentPeriodEnd': null,
        'cancelled': false,
        'inGrace': false,
      }),
    );

    final status = await api.premiumStatus();
    expect(status.active, isFalse);
    expect(status.plan, isNull);
    expect(status.currentPeriodEnd, isNull);
  });

  test('subscribePremium шлёт тариф и карту', () async {
    dioAdapter.onPost(
      '/premium/subscribe',
      (s) => s.reply(201, _activeJson),
      data: {'plan': 'YEAR', 'paymentMethodId': 'pm-1'},
    );

    final status = await api.subscribePremium(
      plan: PremiumPlan.year,
      paymentMethodId: 'pm-1',
    );
    expect(status.active, isTrue);
  });

  test('subscribePremium прокидывает 402 как paymentDeclined', () async {
    dioAdapter.onPost(
      '/premium/subscribe',
      (s) => s.reply(402, {
        'error': {
          'code': 'PAYMENT_DECLINED',
          'message': 'Банк отклонил оплату',
        },
      }),
      data: {'plan': 'MONTH', 'paymentMethodId': 'pm-1'},
    );

    expect(
      () => api.subscribePremium(
        plan: PremiumPlan.month,
        paymentMethodId: 'pm-1',
      ),
      throwsA(
        isA<ApiException>().having(
          (e) => e.code,
          'code',
          ApiErrorCode.paymentDeclined,
        ),
      ),
    );
  });

  test('повторная подписка -> 409 subscriptionExists', () async {
    dioAdapter.onPost(
      '/premium/subscribe',
      (s) => s.reply(409, {
        'error': {
          'code': 'SUBSCRIPTION_EXISTS',
          'message': 'Подписка уже оформлена',
        },
      }),
      data: {'plan': 'MONTH', 'paymentMethodId': 'pm-1'},
    );

    expect(
      () => api.subscribePremium(
        plan: PremiumPlan.month,
        paymentMethodId: 'pm-1',
      ),
      throwsA(
        isA<ApiException>().having(
          (e) => e.code,
          'code',
          ApiErrorCode.subscriptionExists,
        ),
      ),
    );
  });

  test('cancelPremium возвращает статус с cancelled', () async {
    dioAdapter.onPost(
      '/premium/cancel',
      (s) => s.reply(200, {..._activeJson, 'cancelled': true}),
      data: null,
    );

    final status = await api.cancelPremium();
    expect(status.cancelled, isTrue);
    // Доступ остаётся до конца оплаченного периода (Р-09).
    expect(status.active, isTrue);
  });

  test('round-trip PremiumStatus', () {
    final status = PremiumStatus.fromJson(_activeJson);
    expect(PremiumStatus.fromJson(status.toJson()), status);
  });
}
