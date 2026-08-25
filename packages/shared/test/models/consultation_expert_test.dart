// Round-trip ConsultationExpertDto (E7 задача 12) — фикстура зеркалит
// `ConsultationsService.toExpertDto` бэкенда (`consultations.service.ts`):
// PII-инвариант — только clientCode, никакого userId/phone клиента.
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

final _fixture = {
  'id': 'cons-1',
  'status': 'ACTIVE',
  'outcome': null,
  'format': 'video',
  'isEmergency': true,
  'startedAt': '2026-08-25T10:00:00.000Z',
  'endedAt': null,
  'clientCode': 4821,
  'topicSlug': 'anxiety-stress',
  'priceTiyn': 500000,
  'plannedDurationMin': 30,
  'paymentStatus': 'HELD',
};

void main() {
  test('ConsultationExpertDto.fromJson/toJson переносят все поля', () {
    final dto = ConsultationExpertDto.fromJson(_fixture);
    expect(dto.id, 'cons-1');
    expect(dto.status, ConsultationStatus.active);
    expect(dto.outcome, isNull);
    expect(dto.format, SessionFormat.video);
    expect(dto.isEmergency, true);
    expect(dto.startedAt, DateTime.parse('2026-08-25T10:00:00.000Z'));
    expect(dto.endedAt, isNull);
    expect(dto.clientCode, 4821);
    expect(dto.topicSlug, 'anxiety-stress');
    expect(dto.priceTiyn, 500000);
    expect(dto.plannedDurationMin, 30);
    expect(dto.paymentStatus, ConsultationPaymentStatus.held);

    final json = dto.toJson();
    expect(ConsultationExpertDto.fromJson(json), dto);
  });

  test('завершённая консультация: outcome/endedAt заполнены', () {
    final dto = ConsultationExpertDto.fromJson({
      ..._fixture,
      'status': 'COMPLETED',
      'outcome': 'COMPLETED',
      'endedAt': '2026-08-25T10:30:00.000Z',
      'paymentStatus': 'CAPTURED',
    });
    expect(dto.status, ConsultationStatus.completed);
    expect(dto.outcome, ConsultationOutcome.completed);
    expect(dto.endedAt, DateTime.parse('2026-08-25T10:30:00.000Z'));
    expect(dto.paymentStatus, ConsultationPaymentStatus.captured);
  });
}
