import { Injectable } from '@nestjs/common';
import { ConsultationStatus, PaymentStatus, Prisma } from '@prisma/client';
import { ClockService } from '../common/clock/clock.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentOperationalSignalDto } from './dto/payment-operational-signal.dto';
import { SETTLE_MAX_ATTEMPTS } from './settle.constants';

@Injectable()
export class PaymentOperationalSignalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  async operationalSignal(): Promise<PaymentOperationalSignalDto> {
    // One statement gives E and X the same snapshot. Audit history and attempt
    // timestamps cannot tell us whether a payment is currently exhausted.
    const [counts] = await this.prisma.$queryRaw<
      { currentExhaustedCount: number; unexpectedContextCount: number }[]
    >(Prisma.sql`
      SELECT
        (COUNT(*) FILTER (WHERE c.status IN (
          CAST(${ConsultationStatus.COMPLETED} AS "ConsultationStatus"),
          CAST(${ConsultationStatus.CANCELLED} AS "ConsultationStatus")
        )))::int AS "currentExhaustedCount",
        (COUNT(*) FILTER (WHERE (c.status IN (
          CAST(${ConsultationStatus.COMPLETED} AS "ConsultationStatus"),
          CAST(${ConsultationStatus.CANCELLED} AS "ConsultationStatus")
        )) IS NOT TRUE))::int AS "unexpectedContextCount"
      FROM payments p
      LEFT JOIN consultations c ON c.id = p.consultation_id
      WHERE p.status = CAST(${PaymentStatus.HELD} AS "PaymentStatus")
        AND p.settle_attempts >= ${SETTLE_MAX_ATTEMPTS}
    `);
    // A valid aggregate always returns a row, even for an empty database.
    // Missing observations must fail instead of clearing an alert with zeros.
    if (!counts) throw new Error('Payment signal aggregate missing');

    const { currentExhaustedCount, unexpectedContextCount } = counts;
    return {
      signal: 'payment.settle_exhausted',
      state:
        currentExhaustedCount > 0
          ? 'alerting'
          : unexpectedContextCount > 0
            ? 'unknown'
            : 'ok',
      maxAttempts: SETTLE_MAX_ATTEMPTS,
      currentExhaustedCount,
      unexpectedContextCount,
      providerOutcome: 'not_determined_by_source',
      observedAt: this.clock.now().toISOString(),
    };
  }
}
