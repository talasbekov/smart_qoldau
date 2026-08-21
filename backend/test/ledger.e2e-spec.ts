import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  LedgerService,
  ACC_ACQUIRER,
  ACC_COMMISSION,
  expertAccount,
} from '../src/ledger/ledger.service';
import { createApp } from './utils/create-app';

// E5, задача 2: инварианты леджера двойной записи + конкурентность —
// реальная БД (5433), тест сам создаёт и чистит свои данные.
describe('LedgerService (e2e, инварианты и конкурентность)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ledger: LedgerService;

  const EXPERT_ID = 'e2e-ledger-expert-1';
  const REF_ID = 'e2e-ledger-pay-1';
  const REF_ID_CONCURRENT = 'e2e-ledger-pay-concurrent-1';

  async function cleanup() {
    const txs = await prisma.ledgerTransaction.findMany({
      where: { refId: { in: [REF_ID, REF_ID_CONCURRENT] } },
      select: { id: true },
    });
    const txIds = txs.map((t) => t.id);
    if (txIds.length) {
      await prisma.ledgerEntry.deleteMany({
        where: { transactionId: { in: txIds } },
      });
      await prisma.ledgerTransaction.deleteMany({
        where: { id: { in: txIds } },
      });
    }
  }

  beforeAll(async () => {
    app = await createApp(Test.createTestingModule({ imports: [AppModule] }));
    prisma = app.get(PrismaService);
    ledger = app.get(LedgerService);
    await cleanup();
  });

  afterEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await app.close();
  });

  it('post capture-подобной транзакции -> баланс эксперта корректный; повторный post с тем же (kind, refId) не удваивает баланс', async () => {
    const entries = [
      { account: ACC_ACQUIRER, debitTiyn: 399000 },
      { account: expertAccount(EXPERT_ID), creditTiyn: 339150 },
      { account: ACC_COMMISSION, creditTiyn: 59850 },
    ];

    const first = await ledger.post('capture', REF_ID, entries);
    const balanceAfterFirst = await ledger.balanceTiyn(
      expertAccount(EXPERT_ID),
    );
    expect(balanceAfterFirst).toBe(339150);

    const second = await ledger.post('capture', REF_ID, entries);
    expect(second.id).toBe(first.id);

    const balanceAfterSecond = await ledger.balanceTiyn(
      expertAccount(EXPERT_ID),
    );
    expect(balanceAfterSecond).toBe(339150);

    const txCount = await prisma.ledgerTransaction.count({
      where: { kind: 'capture', refId: REF_ID },
    });
    expect(txCount).toBe(1);
  });

  it('два параллельных post с одним ключом (kind, refId) -> ровно одна транзакция в БД', async () => {
    const entries = [
      { account: ACC_ACQUIRER, debitTiyn: 100000 },
      { account: expertAccount(EXPERT_ID), creditTiyn: 85000 },
      { account: ACC_COMMISSION, creditTiyn: 15000 },
    ];

    const [r1, r2] = await Promise.all([
      ledger.post('capture', REF_ID_CONCURRENT, entries),
      ledger.post('capture', REF_ID_CONCURRENT, entries),
    ]);

    expect(r1.id).toBe(r2.id);

    const txCount = await prisma.ledgerTransaction.count({
      where: { kind: 'capture', refId: REF_ID_CONCURRENT },
    });
    expect(txCount).toBe(1);
  });
});
