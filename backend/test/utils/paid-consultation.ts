import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { PaymentsService } from '../../src/payments/payments.service';
import { PaymentMethodsService } from '../../src/payments/payment-methods.service';

const fixtures = new WeakMap<
  INestApplication,
  { consultations: string[]; methods: string[] }
>();

// Existing live-session tests need a real hold through the configured mock
// acquiring port. Never use this in tests of unpaid access or payment itself.
export async function holdConsultation(
  app: INestApplication,
  consultationId: string,
): Promise<void> {
  let owned = fixtures.get(app);
  if (!owned) {
    owned = { consultations: [], methods: [] };
    fixtures.set(app, owned);
  }
  const consultation = await app
    .get(PrismaService)
    .consultation.findUniqueOrThrow({ where: { id: consultationId } });
  const method = await app
    .get(PaymentMethodsService)
    .add(consultation.clientUserId, {
      pan: '4111111111111111',
      expiry: '12/28',
      holderName: 'Session Fixture',
    });
  owned.consultations.push(consultationId);
  owned.methods.push(method.id);
  await app
    .get(PaymentsService)
    .pay(consultationId, consultation.clientUserId, method.id);
}

// Delete only this helper's rows, before the suite deletes its consultations.
export async function cleanupPaidConsultations(
  app: INestApplication,
): Promise<void> {
  const owned = fixtures.get(app);
  if (!owned) return;
  const prisma = app.get(PrismaService);
  const payments = await prisma.payment.findMany({
    where: { consultationId: { in: owned.consultations } },
    select: { id: true },
  });
  const refId = { in: payments.map((payment) => payment.id) };
  await prisma.ledgerEntry.deleteMany({ where: { transaction: { refId } } });
  await prisma.ledgerTransaction.deleteMany({ where: { refId } });
  await prisma.payment.deleteMany({
    where: { consultationId: { in: owned.consultations } },
  });
  await prisma.paymentMethod.deleteMany({
    where: { id: { in: owned.methods } },
  });
  fixtures.delete(app);
}
