import {
  categoriesForAuthor,
  reconcileCreatedTicket,
  reconcileReply,
} from './support';

describe('support contract helpers', () => {
  it('does not expose expert-only categories to clients', () => {
    expect(categoriesForAuthor('client')).toEqual([
      'CONSULTATIONS',
      'PAYMENT',
      'TECHNICAL',
      'ACCOUNT_DATA',
      'SECURITY',
      'OTHER',
    ]);
  });

  it('offers the exact backend category set to experts', () => {
    expect(categoriesForAuthor('expert')).toEqual([
      'CONSULTATIONS',
      'PAYMENT',
      'PAYOUTS',
      'TECHNICAL',
      'VERIFICATION',
      'SECURITY',
      'CLIENT_QUESTION',
    ]);
  });

  it('confirms a lost create response only from one new matching ticket', () => {
    const pending = {
      category: 'TECHNICAL' as const,
      subject: 'Не работает камера',
      baselineIds: ['old'],
    };
    const tickets = [
      {
        id: 'new',
        category: 'TECHNICAL' as const,
        subject: 'Не работает камера',
        status: 'NEW' as const,
        team: 'SUPPORT_OPERATOR' as const,
        createdAt: '2026-09-16T08:00:00.000Z',
        updatedAt: '2026-09-16T08:00:00.000Z',
      },
      {
        id: 'old',
        category: 'TECHNICAL' as const,
        subject: 'Не работает камера',
        status: 'NEW' as const,
        team: 'SUPPORT_OPERATOR' as const,
        createdAt: '2026-09-15T08:00:00.000Z',
        updatedAt: '2026-09-15T08:00:00.000Z',
      },
    ];

    expect(reconcileCreatedTicket(tickets, pending)?.id).toBe('new');
  });

  it('does not guess create success when GET has no unique match', () => {
    const pending = {
      category: 'TECHNICAL' as const,
      subject: 'Не работает камера',
      baselineIds: [],
    };
    const duplicate = {
      id: 'one',
      category: 'TECHNICAL' as const,
      subject: 'Не работает камера',
      status: 'NEW' as const,
      team: 'SUPPORT_OPERATOR' as const,
      createdAt: '2026-09-16T08:00:00.000Z',
      updatedAt: '2026-09-16T08:00:00.000Z',
    };

    expect(
      reconcileCreatedTicket([duplicate, { ...duplicate, id: 'two' }], pending),
    ).toBeNull();
    expect(reconcileCreatedTicket([], pending)).toBeNull();
  });

  it('confirms a lost reply response only from one new matching user message', () => {
    const pending = { body: 'Дополнение', baselineIds: ['old'] };
    const messages = [
      {
        id: 'old',
        authorKind: 'staff' as const,
        body: 'Уточните детали',
        createdAt: '2026-09-16T08:00:00.000Z',
      },
      {
        id: 'new',
        authorKind: 'user' as const,
        body: 'Дополнение',
        createdAt: '2026-09-16T08:01:00.000Z',
      },
    ];

    expect(reconcileReply(messages, pending)?.id).toBe('new');
    expect(
      reconcileReply(
        [...messages, { ...messages[1], id: 'duplicate' }],
        pending,
      ),
    ).toBeNull();
  });
});
