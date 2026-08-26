// Round-trip тест JSON-моделей: фикстуры ниже смоделированы по образцу
// реальных ответов бэкенда (см. схемы в docs/openapi.json — ExpertPublicDto,
// ConsultationClientDto, RequestDto, NotificationsListDto, TicketDetailDto).
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

void main() {
  group('ExpertPublic', () {
    final json = <String, dynamic>{
      'id': 'b6f5b6d2-6f3b-4a3b-9f0a-1b2c3d4e5f60',
      'displayName': 'Айгуль Сатпаева',
      'city': 'Алматы',
      'experience': 'THREE_TO_FIVE',
      'priceTiyn': 500000,
      'languages': ['ru', 'kz'],
      'formats': ['chat', 'audio', 'video'],
      'topicSlugs': ['anxiety-stress', 'burnout'],
      'workStatus': 'ACCEPTING',
      'ratingAvg': 4.8,
      'ratingCount': 23,
      // Публичный контент профиля (E2a): бэкенд отдаёт только одобренное,
      // до модерации оба поля приходят как null.
      'photoUrl': 'https://cdn.smartqoldau.kz/sq-avatars/a1b2.webp',
      'about': 'Работаю с тревогой и выгоранием.',
    };

    test('round-trips through fromJson/toJson', () {
      final expert = ExpertPublic.fromJson(json);

      expect(expert.id, 'b6f5b6d2-6f3b-4a3b-9f0a-1b2c3d4e5f60');
      expect(expert.displayName, 'Айгуль Сатпаева');
      expect(expert.experience, ExperienceLevel.threeToFive);
      expect(expert.priceTiyn, 500000);
      expect(expert.languages, ['ru', 'kz']);
      expect(expert.formats, [
        SessionFormat.chat,
        SessionFormat.audio,
        SessionFormat.video,
      ]);
      expect(expert.workStatus, WorkStatus.accepting);
      expect(expert.ratingAvg, 4.8);
      expect(expert.ratingCount, 23);
      expect(
        expert.photoUrl,
        'https://cdn.smartqoldau.kz/sq-avatars/a1b2.webp',
      );
      expect(expert.about, 'Работаю с тревогой и выгоранием.');
      expect(expert.toJson(), json);
    });
  });

  group('ClientConsultation', () {
    final expertJson = <String, dynamic>{
      'id': 'b6f5b6d2-6f3b-4a3b-9f0a-1b2c3d4e5f60',
      'displayName': 'Айгуль Сатпаева',
      'city': 'Алматы',
      'experience': 'THREE_TO_FIVE',
      'priceTiyn': 500000,
      'languages': ['ru', 'kz'],
      'formats': ['chat', 'audio', 'video'],
      'topicSlugs': ['anxiety-stress', 'burnout'],
      'workStatus': 'ACCEPTING',
      'ratingAvg': 4.8,
      'ratingCount': 23,
      // Публичный контент профиля (E2a): бэкенд отдаёт только одобренное,
      // до модерации оба поля приходят как null.
      'photoUrl': 'https://cdn.smartqoldau.kz/sq-avatars/a1b2.webp',
      'about': 'Работаю с тревогой и выгоранием.',
    };
    // outcome/endedAt присутствуют как null, а не отсутствуют — бэкенд
    // (ConsultationsService.toClientDto) всегда явно присваивает оба поля
    // из строки консультации в БД, так что незавершённая консультация несёт
    // null-значения, а не отсутствующие ключи (в отличие от RequestDto, см.
    // MatchRequest).
    final json = <String, dynamic>{
      'id': 'c1a2b3c4-d5e6-4f70-8899-aabbccddeeff',
      'status': 'ACTIVE',
      'outcome': null,
      'format': 'video',
      'isEmergency': false,
      'startedAt': '2026-08-20T09:15:00.000Z',
      'endedAt': null,
      'priceTiyn': 500000,
      'plannedDurationMin': 50,
      'paymentStatus': 'HELD',
      'expert': expertJson,
      // reviewId приходит с бэкенда (E2a): до отзыва — null.
      'reviewId': null,
    };

    test('round-trips through fromJson/toJson with a still-active consultation (outcome/endedAt null)', () {
      final consultation = ClientConsultation.fromJson(json);

      expect(consultation.id, 'c1a2b3c4-d5e6-4f70-8899-aabbccddeeff');
      expect(consultation.status, ConsultationStatus.active);
      expect(consultation.outcome, isNull);
      expect(consultation.format, SessionFormat.video);
      expect(consultation.isEmergency, false);
      expect(
        consultation.startedAt,
        DateTime.parse('2026-08-20T09:15:00.000Z'),
      );
      expect(consultation.endedAt, isNull);
      expect(consultation.priceTiyn, 500000);
      expect(consultation.plannedDurationMin, 50);
      expect(consultation.paymentStatus, ConsultationPaymentStatus.held);
      expect(consultation.expert.id, expertJson['id']);
      expect(consultation.reviewId, isNull);
      expect(consultation.toJson(), json);
    });
  });

  group('MatchRequest', () {
    final json = <String, dynamic>{
      'id': 'd1e2f3a4-1234-4567-8901-abcdefabcdef',
      'status': 'CALLBACK_REQUESTED',
      'isEmergency': true,
      'clientCode': 4821,
      'hotlines': ['150', '103', '112'],
    };

    test('round-trips through fromJson/toJson with matchedExpert/consultationId absent', () {
      final request = MatchRequest.fromJson(json);

      expect(request.id, 'd1e2f3a4-1234-4567-8901-abcdefabcdef');
      expect(request.status, RequestStatus.callbackRequested);
      expect(request.isEmergency, true);
      expect(request.clientCode, 4821);
      expect(request.matchedExpert, isNull);
      expect(request.consultationId, isNull);
      expect(request.hotlines, ['150', '103', '112']);
      expect(request.toJson(), json);
    });

    test(
      'maps RequestStatus.callbackRequested to CALLBACK_REQUESTED on the wire',
      () {
        expect(
          MatchRequest.fromJson(json).status,
          RequestStatus.callbackRequested,
        );
        expect(
          request(RequestStatus.callbackRequested).toJson()['status'],
          'CALLBACK_REQUESTED',
        );
      },
    );
  });

  group('NotificationsPage', () {
    final json = <String, dynamic>{
      'items': [
        {
          'id': 'n1',
          'type': 'consultation.matched',
          'title': 'Специалист найден',
          'body': 'Ваша заявка подтверждена',
          'data': {'consultationId': 'c1a2b3c4-d5e6-4f70-8899-aabbccddeeff'},
          'readAt': null,
          'createdAt': '2026-08-20T09:00:00.000Z',
        },
      ],
      'unreadCount': 1,
    };

    test('round-trips through fromJson/toJson including a null readAt', () {
      final page = NotificationsPage.fromJson(json);

      expect(page.items, hasLength(1));
      expect(page.items.single.id, 'n1');
      expect(page.items.single.readAt, isNull);
      expect(page.items.single.data, {
        'consultationId': 'c1a2b3c4-d5e6-4f70-8899-aabbccddeeff',
      });
      expect(page.unreadCount, 1);
      expect(page.toJson(), json);
    });
  });

  group('TicketDetail', () {
    final json = <String, dynamic>{
      'id': 't1a2b3c4-d5e6-4f70-8899-aabbccddeeff',
      'category': 'TECHNICAL',
      'subject': 'Не подключается видео',
      'status': 'IN_PROGRESS',
      'team': 'SUPPORT_OPERATOR',
      'createdAt': '2026-08-19T12:00:00.000Z',
      'updatedAt': '2026-08-20T08:00:00.000Z',
      'body': 'После обновления приложения не запускается видеозвонок',
      'firstReplyAt': '2026-08-19T13:00:00.000Z',
      'resolvedAt': null,
      'relatedConsultationId': 'c1a2b3c4-d5e6-4f70-8899-aabbccddeeff',
      'relatedPayoutId': null,
      'messages': [
        {
          'id': 'm1',
          'authorKind': 'user',
          'body': 'После обновления приложения не запускается видеозвонок',
          'createdAt': '2026-08-19T12:00:00.000Z',
        },
        {
          'id': 'm2',
          'authorKind': 'staff',
          'body': 'Попробуйте переустановить приложение',
          'createdAt': '2026-08-19T13:00:00.000Z',
        },
      ],
    };

    test(
      'round-trips through fromJson/toJson including the message thread',
      () {
        final ticket = TicketDetail.fromJson(json);

        expect(ticket.id, 't1a2b3c4-d5e6-4f70-8899-aabbccddeeff');
        expect(ticket.category, TicketCategory.technical);
        expect(ticket.status, TicketStatus.inProgress);
        expect(ticket.team, TicketTeam.supportOperator);
        expect(ticket.resolvedAt, isNull);
        expect(ticket.relatedPayoutId, isNull);
        expect(ticket.messages, hasLength(2));
        expect(ticket.messages.first.authorKind, TicketAuthorKind.user);
        expect(ticket.messages.last.authorKind, TicketAuthorKind.staff);
        expect(ticket.toJson(), json);
      },
    );
  });

  group('enum wire mapping', () {
    test('ExperienceLevel.moreThanTen maps to MORE_THAN_TEN', () {
      final json = <String, dynamic>{
        'id': 'e1',
        'displayName': 'Тест',
        'city': 'Астана',
        'experience': 'MORE_THAN_TEN',
        'priceTiyn': 100000,
        'languages': ['ru'],
        'formats': ['chat'],
        'topicSlugs': ['burnout'],
        'workStatus': 'BUSY',
        'ratingAvg': 5.0,
        'ratingCount': 1,
      };

      final expert = ExpertPublic.fromJson(json);

      expect(expert.experience, ExperienceLevel.moreThanTen);
      expect(expert.toJson()['experience'], 'MORE_THAN_TEN');
    });

    test(
      'TicketStatus enum values map to the backend Prisma enum literally',
      () {
        expect(_ticketWithStatus(TicketStatus.new_).toJson()['status'], 'NEW');
        expect(
          _ticketWithStatus(TicketStatus.inProgress).toJson()['status'],
          'IN_PROGRESS',
        );
        expect(
          _ticketWithStatus(TicketStatus.resolved).toJson()['status'],
          'RESOLVED',
        );
      },
    );

    test(
      'TicketCategory enum values map to the backend Prisma enum literally',
      () {
        const expected = {
          TicketCategory.consultations: 'CONSULTATIONS',
          TicketCategory.payment: 'PAYMENT',
          TicketCategory.payouts: 'PAYOUTS',
          TicketCategory.technical: 'TECHNICAL',
          TicketCategory.verification: 'VERIFICATION',
          TicketCategory.security: 'SECURITY',
          TicketCategory.clientQuestion: 'CLIENT_QUESTION',
          TicketCategory.accountData: 'ACCOUNT_DATA',
          TicketCategory.other: 'OTHER',
        };
        for (final entry in expected.entries) {
          expect(
            _ticketWithCategory(entry.key).toJson()['category'],
            entry.value,
          );
        }
      },
    );

    test('TicketTeam enum values map to the backend Prisma enum literally', () {
      const expected = {
        TicketTeam.supportOperator: 'SUPPORT_OPERATOR',
        TicketTeam.verificationOperator: 'VERIFICATION_OPERATOR',
        TicketTeam.financeControl: 'FINANCE_CONTROL',
        TicketTeam.qualityTeam: 'QUALITY_TEAM',
      };
      for (final entry in expected.entries) {
        expect(_ticketWithTeam(entry.key).toJson()['team'], entry.value);
      }
    });

    test(
      'TicketAuthorKind enum values map to the lowercase backend strings',
      () {
        expect(
          _messageWithAuthorKind(TicketAuthorKind.user).toJson()['authorKind'],
          'user',
        );
        expect(
          _messageWithAuthorKind(TicketAuthorKind.staff).toJson()['authorKind'],
          'staff',
        );
      },
    );
  });
}

MatchRequest request(RequestStatus status) =>
    MatchRequest(id: 'x', status: status, isEmergency: false, clientCode: 1);

TicketSummary _ticketWithStatus(TicketStatus status) => TicketSummary(
  id: 't1',
  category: TicketCategory.other,
  subject: 's',
  status: status,
  team: TicketTeam.supportOperator,
  createdAt: DateTime.utc(2026, 1, 1),
  updatedAt: DateTime.utc(2026, 1, 1),
);

TicketSummary _ticketWithCategory(TicketCategory category) => TicketSummary(
  id: 't1',
  category: category,
  subject: 's',
  status: TicketStatus.new_,
  team: TicketTeam.supportOperator,
  createdAt: DateTime.utc(2026, 1, 1),
  updatedAt: DateTime.utc(2026, 1, 1),
);

TicketSummary _ticketWithTeam(TicketTeam team) => TicketSummary(
  id: 't1',
  category: TicketCategory.other,
  subject: 's',
  status: TicketStatus.new_,
  team: team,
  createdAt: DateTime.utc(2026, 1, 1),
  updatedAt: DateTime.utc(2026, 1, 1),
);

TicketMessage _messageWithAuthorKind(TicketAuthorKind authorKind) =>
    TicketMessage(
      id: 'm1',
      authorKind: authorKind,
      body: 'b',
      createdAt: DateTime.utc(2026, 1, 1),
    );
