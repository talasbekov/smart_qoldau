import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

describe('Prisma Payments schema', () => {
  const s = new PrismaService();
  beforeAll(() => s.$connect());
  afterAll(() => s.$disconnect());

  it('Payment уникален по consultationId; LedgerTransaction уникален по (kind, refId); ProviderEvent уникален по providerEventId', async () => {
    const topic = await s.topic.findUniqueOrThrow({
      where: { slug: 'anxiety-stress' },
    });
    const user = await s.user.create({ data: { phone: '+77070000005' } });
    const expertUser = await s.user.create({ data: { phone: '+77070000006' } });
    const expert = await s.expert.create({
      data: {
        userId: expertUser.id,
        displayName: 'Тестовый эксперт платежа',
        city: 'Алматы',
        experience: 'ONE_TO_THREE',
        education: 'Образование',
        priceTiyn: 500000,
        languages: ['ru'],
        formats: ['chat'],
      },
    });

    const now = new Date();
    const consultation = await s.consultation.create({
      data: {
        requestId: 'req-payment-uniq-1',
        clientUserId: user.id,
        clientCode: 1234,
        expertId: expert.id,
        topicId: topic.id,
        format: 'chat',
        priceTiyn: 500000,
        startedAt: now,
      },
    });

    // PaymentMethod
    const paymentMethod = await s.paymentMethod.create({
      data: {
        userId: user.id,
        providerToken: 'tok_visa_4521',
        maskedPan: '**** 4521',
        brand: 'visa',
        holderName: 'Test User',
      },
    });

    // Payment
    const commissionTiyn = Math.round(500000 * 0.15);
    const payment = await s.payment.create({
      data: {
        consultationId: consultation.id,
        clientUserId: user.id,
        expertId: expert.id,
        paymentMethodId: paymentMethod.id,
        amountTiyn: 500000,
        commissionTiyn,
      },
    });

    expect(payment.status).toBe('PENDING');
    expect(payment.discountTiyn).toBe(0);
    expect(payment.reholdCount).toBe(0);
    expect(payment.settleAttempts).toBe(0);

    // Payment уникален по consultationId
    await expect(
      s.payment.create({
        data: {
          consultationId: consultation.id,
          clientUserId: user.id,
          expertId: expert.id,
          paymentMethodId: paymentMethod.id,
          amountTiyn: 500000,
          commissionTiyn,
        },
      }),
    ).rejects.toMatchObject({
      code: 'P2002',
    } as Partial<Prisma.PrismaClientKnownRequestError>);

    // LedgerTransaction
    const ledgerTransaction = await s.ledgerTransaction.create({
      data: {
        kind: 'capture',
        refId: payment.id,
        entries: {
          create: [
            {
              account: `expert:${expert.id}`,
              creditTiyn: 500000 - commissionTiyn,
            },
            {
              account: 'platform:commission',
              creditTiyn: commissionTiyn,
            },
          ],
        },
      },
    });

    expect(ledgerTransaction.kind).toBe('capture');

    // LedgerTransaction уникален по (kind, refId)
    await expect(
      s.ledgerTransaction.create({
        data: {
          kind: 'capture',
          refId: payment.id,
        },
      }),
    ).rejects.toMatchObject({
      code: 'P2002',
    } as Partial<Prisma.PrismaClientKnownRequestError>);

    // ProviderEvent
    const providerEvent = await s.providerEvent.create({
      data: {
        providerEventId: 'evt_webhook_12345',
        kind: 'payment',
        payload: { status: 'held', hold_id: 'hold_123' },
      },
    });

    expect(providerEvent.kind).toBe('payment');

    // ProviderEvent уникален по providerEventId
    await expect(
      s.providerEvent.create({
        data: {
          providerEventId: 'evt_webhook_12345',
          kind: 'payment',
          payload: {},
        },
      }),
    ).rejects.toMatchObject({
      code: 'P2002',
    } as Partial<Prisma.PrismaClientKnownRequestError>);

    // Payout
    const payout = await s.payout.create({
      data: {
        expertId: expert.id,
        amountTiyn: 425000,
        maskedPan: '**** 4521',
        holderName: 'Test Expert',
        cardToken: 'tok_payout_expert_1',
        status: 'PENDING_REVIEW',
      },
    });

    expect(payout.status).toBe('PENDING_REVIEW');

    // очистка: payout → ledgerEntries → transaction → payment → consultation/paymentMethod/expert/user
    const entries = await s.ledgerEntry.findMany({
      where: { transactionId: ledgerTransaction.id },
    });
    for (const entry of entries) {
      await s.ledgerEntry.delete({ where: { id: entry.id } });
    }
    await s.ledgerTransaction.delete({ where: { id: ledgerTransaction.id } });
    await s.payout.delete({ where: { id: payout.id } });
    await s.providerEvent.delete({ where: { id: providerEvent.id } });
    await s.payment.delete({ where: { id: payment.id } });
    await s.paymentMethod.delete({ where: { id: paymentMethod.id } });
    await s.consultation.delete({ where: { id: consultation.id } });
    await s.expert.delete({ where: { id: expert.id } });
    await s.user.delete({ where: { id: expertUser.id } });
    await s.user.delete({ where: { id: user.id } });
  });
});
