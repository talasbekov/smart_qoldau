// Р-08: цены Premium приходят из API, а не хранятся копией в приложении.
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

  test('разбирает тарифы и раскладывает по планам', () async {
    dioAdapter.onGet(
      '/premium/plans',
      (server) => server.reply(200, {
        'plans': [
          {'plan': 'MONTH', 'priceTiyn': 499000, 'periodDays': 30},
          {'plan': 'YEAR', 'priceTiyn': 3990000, 'periodDays': 365},
        ],
        'discountPercent': 10,
      }),
    );

    final plans = await api.premiumPlans();

    expect(plans.priceTiyn(PremiumPlan.month), 499000);
    expect(plans.priceTiyn(PremiumPlan.year), 3990000);
    expect(plans.discountPercent, 10);
  });

  test('неизвестный план не роняет разбор', () async {
    dioAdapter.onGet(
      '/premium/plans',
      (server) => server.reply(200, {
        'plans': [
          {'plan': 'WEEK', 'priceTiyn': 99000, 'periodDays': 7},
          {'plan': 'MONTH', 'priceTiyn': 499000, 'periodDays': 30},
        ],
        'discountPercent': 10,
      }),
    );

    // Бэкенд может завести новый тариф раньше, чем приложение о нём
    // узнает: старая версия должна показать то, что понимает, а не упасть.
    final plans = await api.premiumPlans();

    expect(plans.priceTiyn(PremiumPlan.month), 499000);
    expect(plans.priceTiyn(PremiumPlan.year), isNull);
  });
}
