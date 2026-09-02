import 'package:freezed_annotation/freezed_annotation.dart';

part 'premium_status.freezed.dart';
part 'premium_status.g.dart';

/// Тарифы Premium (Р-08): 4 990 ₸ в месяц или 39 900 ₸ в год. Состав у обоих
/// одинаковый, годовой отличается только ценой и длиной периода.
enum PremiumPlan {
  @JsonValue('MONTH')
  month,
  @JsonValue('YEAR')
  year,
}

/// `GET /premium` — статус подписки (`PremiumStatusDto` бэкенда).
@freezed
abstract class PremiumStatus with _$PremiumStatus {
  const factory PremiumStatus({
    /// Доступ к Premium прямо сейчас. Остаётся true после отмены — до конца
    /// оплаченного периода — и во время ретраев автопродления (Р-09).
    required bool active,
    required bool cancelled,

    /// Оплата не прошла, идут попытки списания; доступ пока сохраняется.
    required bool inGrace,
    PremiumPlan? plan,
    DateTime? currentPeriodEnd,
  }) = _PremiumStatus;

  /// Подписки нет — состояние по умолчанию до первого ответа бэкенда.
  /// Именованным конструктором это сделать нельзя: freezed тогда не может
  /// решить, кому из вариантов принадлежит fromJson.
  static const PremiumStatus none = PremiumStatus(
    active: false,
    cancelled: false,
    inGrace: false,
  );

  factory PremiumStatus.fromJson(Map<String, dynamic> json) =>
      _$PremiumStatusFromJson(json);
}
