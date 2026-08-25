import 'package:freezed_annotation/freezed_annotation.dart';

import 'enums.dart';

part 'payout.freezed.dart';
part 'payout.g.dart';

/// Заявка на вывод средств эксперта (`PayoutDto` бэкенда, Р-06). PAN
/// открытым текстом бэкенд не хранит и не возвращает — только
/// [maskedPan].
@freezed
abstract class PayoutDto with _$PayoutDto {
  const factory PayoutDto({
    required String id,
    required int amountTiyn,
    required String maskedPan,
    required PayoutStatus status,
    String? rejectReason,
    required DateTime createdAt,
  }) = _PayoutDto;

  factory PayoutDto.fromJson(Map<String, dynamic> json) =>
      _$PayoutDtoFromJson(json);
}
