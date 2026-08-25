// Юнит-тесты обращений в поддержку (Step 3 брифа задачи 19): набор
// клиентских категорий, создание обращения, отказ по категории и
// автоматическое обращение на удаление аккаунта.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_client/features/support/state/tickets_controller.dart';

class MockSqApi extends Mock implements SqApi {}

TicketSummary _ticket(String id) => TicketSummary(
  id: id,
  category: TicketCategory.technical,
  subject: 'Не работает звонок',
  status: TicketStatus.new_,
  team: TicketTeam.supportOperator,
  createdAt: DateTime(2026, 8, 22, 10),
  updatedAt: DateTime(2026, 8, 22, 10),
);

ProviderContainer _container(SqApi api) {
  final container = ProviderContainer(
    overrides: [sqApiProvider.overrideWithValue(api)],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  late MockSqApi api;

  setUp(() {
    api = MockSqApi();
    when(
      () => api.tickets(take: any(named: 'take'), skip: any(named: 'skip')),
    ).thenAnswer((_) async => [_ticket('t1')]);
    when(
      () => api.createTicket(
        category: any(named: 'category'),
        subject: any(named: 'subject'),
        body: any(named: 'body'),
        contactEmail: any(named: 'contactEmail'),
        contactPhone: any(named: 'contactPhone'),
        relatedConsultationId: any(named: 'relatedConsultationId'),
        relatedPayoutId: any(named: 'relatedPayoutId'),
      ),
    ).thenAnswer((_) async {});
  });

  test('клиенту доступны ровно шесть категорий', () {
    // Экспертные категории (`PAYOUTS`, `VERIFICATION`, `CLIENT_QUESTION`)
    // бэкенд клиенту не разрешает — `CATEGORIES_BY_AUTHOR` в
    // `ticket-routing.ts`. Показывать их значило бы вести человека в
    // гарантированный отказ.
    expect(clientTicketCategories, [
      TicketCategory.consultations,
      TicketCategory.payment,
      TicketCategory.technical,
      TicketCategory.accountData,
      TicketCategory.security,
      TicketCategory.other,
    ]);
  });

  test('создание шлёт выбранную категорию и обновляет список', () async {
    final container = _container(api);
    container.listen(
      ticketsControllerProvider,
      (previous, next) {},
      fireImmediately: true,
    );
    await container.read(ticketsControllerProvider.future);

    await container
        .read(ticketsControllerProvider.notifier)
        .create(
          category: TicketCategory.payment,
          subject: 'Двойное списание',
          body: 'Списали дважды за одну консультацию',
        );

    verify(
      () => api.createTicket(
        category: 'PAYMENT',
        subject: 'Двойное списание',
        body: 'Списали дважды за одну консультацию',
        contactEmail: null,
        contactPhone: null,
        relatedConsultationId: null,
        relatedPayoutId: null,
      ),
    ).called(1);
    verify(
      () => api.tickets(take: any(named: 'take'), skip: any(named: 'skip')),
    ).called(2);
  });

  test('привязка к консультации уходит вместе с обращением', () async {
    final container = _container(api);
    container.listen(
      ticketsControllerProvider,
      (previous, next) {},
      fireImmediately: true,
    );
    await container.read(ticketsControllerProvider.future);

    await container
        .read(ticketsControllerProvider.notifier)
        .create(
          category: TicketCategory.consultations,
          subject: 'Психолог не подключился',
          body: 'Ждал 10 минут',
          relatedConsultationId: 'c1',
        );

    verify(
      () => api.createTicket(
        category: 'CONSULTATIONS',
        subject: 'Психолог не подключился',
        body: 'Ждал 10 минут',
        contactEmail: null,
        contactPhone: null,
        relatedConsultationId: 'c1',
        relatedPayoutId: null,
      ),
    ).called(1);
  });

  test('TICKET_CATEGORY_NOT_ALLOWED пробрасывается наружу как ApiException', () async {
    when(
      () => api.createTicket(
        category: any(named: 'category'),
        subject: any(named: 'subject'),
        body: any(named: 'body'),
        contactEmail: any(named: 'contactEmail'),
        contactPhone: any(named: 'contactPhone'),
        relatedConsultationId: any(named: 'relatedConsultationId'),
        relatedPayoutId: any(named: 'relatedPayoutId'),
      ),
    ).thenAnswer(
      (_) async => throw const ApiException(
        ApiErrorCode.ticketCategoryNotAllowed,
        'not allowed',
        409,
      ),
    );

    final container = _container(api);
    container.listen(
      ticketsControllerProvider,
      (previous, next) {},
      fireImmediately: true,
    );
    await container.read(ticketsControllerProvider.future);

    await expectLater(
      container.read(ticketsControllerProvider.notifier).create(
        category: TicketCategory.payment,
        subject: 'Тема',
        body: 'Текст',
      ),
      throwsA(
        isA<ApiException>().having(
          (e) => e.code,
          'code',
          ApiErrorCode.ticketCategoryNotAllowed,
        ),
      ),
    );
  });

  test('удаление аккаунта создаёт обращение ACCOUNT_DATA с нужной темой', () async {
    // Прямого эндпоинта удаления аккаунта у бэкенда нет (решение 9) —
    // запрос идёт обращением в поддержку.
    final container = _container(api);
    container.listen(
      ticketsControllerProvider,
      (previous, next) {},
      fireImmediately: true,
    );
    await container.read(ticketsControllerProvider.future);

    await container
        .read(ticketsControllerProvider.notifier)
        .create(
          category: TicketCategory.accountData,
          subject: 'Удаление аккаунта и данных',
          body: 'Прошу удалить мой аккаунт и связанные с ним данные',
        );

    verify(
      () => api.createTicket(
        category: 'ACCOUNT_DATA',
        subject: 'Удаление аккаунта и данных',
        body: 'Прошу удалить мой аккаунт и связанные с ним данные',
        contactEmail: null,
        contactPhone: null,
        relatedConsultationId: null,
        relatedPayoutId: null,
      ),
    ).called(1);
  });

  test('обращение с перепиской читается по идентификатору', () async {
    when(() => api.ticketById('t1')).thenAnswer(
      (_) async => TicketDetail(
        id: 't1',
        category: TicketCategory.technical,
        subject: 'Не работает звонок',
        status: TicketStatus.inProgress,
        team: TicketTeam.supportOperator,
        createdAt: DateTime(2026, 8, 22, 10),
        updatedAt: DateTime(2026, 8, 22, 11),
        body: 'Звонок обрывается',
        firstReplyAt: DateTime(2026, 8, 22, 11),
        resolvedAt: null,
        relatedConsultationId: null,
        relatedPayoutId: null,
        messages: [
          TicketMessage(
            id: 'm1',
            authorKind: TicketAuthorKind.staff,
            body: 'Проверяем',
            createdAt: DateTime(2026, 8, 22, 11),
          ),
        ],
      ),
    );

    final container = _container(api);
    final detail = await container.read(ticketDetailProvider('t1').future);

    expect(detail.messages.single.authorKind, TicketAuthorKind.staff);
    expect(detail.status, TicketStatus.inProgress);
  });
}
