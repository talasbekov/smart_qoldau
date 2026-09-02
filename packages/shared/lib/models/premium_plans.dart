import 'premium_status.dart';

/// Тарифы Premium из `GET /premium/plans`.
///
/// Цены живут на бэкенде и приходят по API. Копия в приложении означала
/// бы, что смена цены требует релиза в маркетах и что до его раскатки
/// разные люди видят разные суммы.
class PremiumPlans {
  const PremiumPlans({required this.prices, required this.discountPercent});

  final Map<PremiumPlan, int> prices;

  /// Скидка Premium на консультацию, в процентах.
  final int discountPercent;

  int? priceTiyn(PremiumPlan plan) => prices[plan];

  factory PremiumPlans.fromJson(Map<String, dynamic> json) {
    final prices = <PremiumPlan, int>{};
    for (final raw in (json['plans'] as List<dynamic>? ?? const [])) {
      final item = raw as Map<String, dynamic>;
      // Неизвестный тариф пропускаем молча: бэкенд может завести новый
      // раньше, чем приложение о нём узнает, и старая версия должна
      // показать то, что понимает, а не упасть.
      final plan = switch (item['plan'] as String?) {
        'MONTH' => PremiumPlan.month,
        'YEAR' => PremiumPlan.year,
        _ => null,
      };
      if (plan != null) prices[plan] = (item['priceTiyn'] as num).toInt();
    }

    return PremiumPlans(
      prices: prices,
      discountPercent: (json['discountPercent'] as num?)?.toInt() ?? 0,
    );
  }
}
