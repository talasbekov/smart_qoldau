import { Injectable } from '@nestjs/common';
import { LedgerTransaction, Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';

export const ACC_ACQUIRER = 'acquirer:settlement';
export const ACC_COMMISSION = 'platform:commission';
export const ACC_PAYOUT_PENDING = 'payout:pending';
export const ACC_PAYOUT_SENT = 'payout:sent';

export function expertAccount(expertId: string): string {
  return `expert:${expertId}`;
}

export interface LedgerEntryInput {
  account: string;
  debitTiyn?: number;
  creditTiyn?: number;
}

@Injectable()
export class LedgerService {
  constructor(private prisma: PrismaService) {}

  // Проводки двойной записи: ≥2 записей, в каждой ровно одно из debit/credit
  // (положительное целое), Σdebit === Σcredit — иначе throw ДО записи в БД.
  // Идемпотентность по (kind, refId): при P2002 возвращаем существующую
  // транзакцию вместо повторной записи. Принимает внешний tx — capture
  // пишется атомарно вместе с Payment.
  async post(
    kind: string,
    refId: string,
    entries: LedgerEntryInput[],
    tx?: Prisma.TransactionClient,
  ): Promise<LedgerTransaction> {
    if (!entries || entries.length < 2) {
      throw new Error('LEDGER_UNBALANCED');
    }

    let sumDebit = 0;
    let sumCredit = 0;
    for (const e of entries) {
      const debit = e.debitTiyn ?? 0;
      const credit = e.creditTiyn ?? 0;

      // Обе стороны — неотрицательные целые ВСЕГДА, не только доминирующая:
      // иначе {debit: 200, credit: -100} проходит XOR-гейт и пишет
      // отрицательный кредит в БД (баланс при этом может сойтись).
      if (!Number.isInteger(debit) || debit < 0) {
        throw new Error('LEDGER_UNBALANCED');
      }
      if (!Number.isInteger(credit) || credit < 0) {
        throw new Error('LEDGER_UNBALANCED');
      }

      const hasDebit = debit > 0;
      const hasCredit = credit > 0;
      if (hasDebit === hasCredit) {
        // оба нулевые или оба заданы -> нарушение "ровно одно из"
        throw new Error('LEDGER_UNBALANCED');
      }

      sumDebit += debit;
      sumCredit += credit;
    }

    if (sumDebit !== sumCredit) {
      throw new Error('LEDGER_UNBALANCED');
    }

    const db = tx ?? this.prisma;

    // Идемпотентность проверяется ДО insert: внутри внешней prisma-транзакции
    // упавший на P2002 insert абортирует postgres-транзакцию (25P02), и
    // catch-ветка с findUnique была бы мертва — любой повторный settle,
    // догнавший гонку, откатывал бы всю обвязку. Предварительный findUnique
    // закрывает штатный повтор; остаточная гонка двух одновременных post с
    // одним (kind, refId) по-прежнему ловится P2002 (вне транзакции — с
    // восстановлением, внутри — откатом проигравшего, который добёрет
    // существующую проводку на следующем ретрае).
    const existing = await db.ledgerTransaction.findUnique({
      where: { kind_refId: { kind, refId } },
    });
    if (existing) return existing;

    try {
      return await db.ledgerTransaction.create({
        data: {
          kind,
          refId,
          entries: {
            create: entries.map((e) => ({
              account: e.account,
              debitTiyn: e.debitTiyn ?? 0,
              creditTiyn: e.creditTiyn ?? 0,
            })),
          },
        },
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        const recovered = await db.ledgerTransaction.findUnique({
          where: { kind_refId: { kind, refId } },
        });
        if (recovered) return recovered;
      }
      throw e;
    }
  }

  // Σcredit − Σdebit по счёту (для expert:{id} кредит = приход). Один
  // агрегатный запрос.
  async balanceTiyn(
    account: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const db = tx ?? this.prisma;
    const result = await db.ledgerEntry.aggregate({
      where: { account },
      _sum: { debitTiyn: true, creditTiyn: true },
    });
    const debit = result._sum.debitTiyn ?? 0;
    const credit = result._sum.creditTiyn ?? 0;
    return credit - debit;
  }
}
