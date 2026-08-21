import { LedgerService } from './ledger.service';

// Юнит: реальная Prisma не нужна — мок объектом-заглушкой.
// Проверяем только валидацию инвариантов ДО обращения к БД.
describe('LedgerService (юнит, валидация)', () => {
  function makePrismaMock() {
    return {
      ledgerTransaction: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
    } as any;
  }

  it('несбалансированная (Σdebit !== Σcredit) -> throw LEDGER_UNBALANCED, ничего не записано', async () => {
    const prisma = makePrismaMock();
    const service = new LedgerService(prisma);

    await expect(
      service.post('capture', 'pay-1', [
        { account: 'acquirer:settlement', debitTiyn: 399000 },
        { account: 'expert:e1', creditTiyn: 339150 },
        // не хватает 59850 -> Σdebit=399000, Σcredit=339150
      ]),
    ).rejects.toThrow('LEDGER_UNBALANCED');

    expect(prisma.ledgerTransaction.create).not.toHaveBeenCalled();
  });

  it('проводка с debit и credit одновременно -> throw, ничего не записано', async () => {
    const prisma = makePrismaMock();
    const service = new LedgerService(prisma);

    await expect(
      service.post('capture', 'pay-2', [
        { account: 'acquirer:settlement', debitTiyn: 399000, creditTiyn: 100 },
        { account: 'expert:e1', creditTiyn: 399000 },
      ]),
    ).rejects.toThrow();

    expect(prisma.ledgerTransaction.create).not.toHaveBeenCalled();
  });

  it('проводка без debit и без credit -> throw, ничего не записано', async () => {
    const prisma = makePrismaMock();
    const service = new LedgerService(prisma);

    await expect(
      service.post('capture', 'pay-3', [
        { account: 'acquirer:settlement' },
        { account: 'expert:e1', creditTiyn: 0 },
      ]),
    ).rejects.toThrow();

    expect(prisma.ledgerTransaction.create).not.toHaveBeenCalled();
  });

  it('менее 2 проводок -> throw, ничего не записано', async () => {
    const prisma = makePrismaMock();
    const service = new LedgerService(prisma);

    await expect(
      service.post('capture', 'pay-4', [
        { account: 'acquirer:settlement', debitTiyn: 100 },
      ]),
    ).rejects.toThrow();

    expect(prisma.ledgerTransaction.create).not.toHaveBeenCalled();
  });

  it('неинтегральная/неположительная сумма -> throw, ничего не записано', async () => {
    const prisma = makePrismaMock();
    const service = new LedgerService(prisma);

    await expect(
      service.post('capture', 'pay-5', [
        { account: 'acquirer:settlement', debitTiyn: 100.5 },
        { account: 'expert:e1', creditTiyn: 100.5 },
      ]),
    ).rejects.toThrow();

    await expect(
      service.post('capture', 'pay-6', [
        { account: 'acquirer:settlement', debitTiyn: -100 },
        { account: 'expert:e1', creditTiyn: -100 },
      ]),
    ).rejects.toThrow();

    expect(prisma.ledgerTransaction.create).not.toHaveBeenCalled();
  });

  it('отрицательная сумма на недоминирующей стороне -> throw, ничего не записано', async () => {
    const prisma = makePrismaMock();
    const service = new LedgerService(prisma);

    // debit 200 > 0 проходит XOR-гейт, credit -100 «не задан» для hasCredit,
    // но суммы сходятся (200 == -100 + 300) — без явной проверки >= 0 обеих
    // сторон отрицательный кредит утёк бы в БД.
    await expect(
      service.post('adjustment', 'adj-1', [
        { account: 'acquirer:settlement', debitTiyn: 200, creditTiyn: -100 },
        { account: 'expert:e1', creditTiyn: 300 },
      ]),
    ).rejects.toThrow('LEDGER_UNBALANCED');

    expect(prisma.ledgerTransaction.create).not.toHaveBeenCalled();
  });
});
