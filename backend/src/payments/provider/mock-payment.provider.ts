import { Injectable, ConflictException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RedisService } from '../../redis/redis.service';
import { PaymentProviderPort } from './payment-provider.port';

interface HoldRecord {
  providerHoldId: string;
  token: string;
  amountTiyn: number;
  status: 'held' | 'captured' | 'voided';
}

// 30 дней: живёт дольше 5-дневного горизонта перехолда и любых поздних
// settle — 24-часовой TTL ронял capture/void в dev/staging («Холд не
// найден») для консультаций, завершившихся позже суток после оплаты.
const HOLD_TTL_SECONDS = 30 * 24 * 60 * 60;

// Детерминированный мок-провайдер платежей для dev/тестов. Состояние
// холдов хранится в Redis (mockpay:hold:{id}), идемпотентность успешных
// холдов — по mockpay:idem:{key}. Тестовый PAN, оканчивающийся на 0002,
// всегда получает decline (симуляция отказа банка).
@Injectable()
export class MockPaymentProvider extends PaymentProviderPort {
  constructor(private redis: RedisService) {
    super();
  }

  private holdKey(id: string): string {
    return `mockpay:hold:${id}`;
  }

  private idemKey(key: string): string {
    return `mockpay:idem:${key}`;
  }

  async tokenizeCard(input: {
    pan: string;
    expiry: string;
    holderName: string;
  }): Promise<{ token: string; maskedPan: string; brand: string }> {
    const { pan } = input;
    const last4 = pan.slice(-4);
    const maskedPan = `**** ${last4}`;
    let brand = 'unknown';
    if (pan.startsWith('4')) brand = 'visa';
    else if (pan.startsWith('5')) brand = 'mastercard';
    // Признак decline-сценария (PAN, оканчивающийся на 0002) зашивается в
    // токен, т.к. hold() дальше видит только token, а не исходный PAN —
    // PAN нигде не хранится и не передаётся дальше точки токенизации.
    const token = `mockpay_tok_${last4}_${randomUUID()}`;
    return { token, maskedPan, brand };
  }

  async hold(input: {
    idempotencyKey: string;
    token: string;
    amountTiyn: number;
  }): Promise<{
    providerHoldId: string;
    status: 'held' | 'declined';
    declineReason?: string;
  }> {
    const { idempotencyKey, token, amountTiyn } = input;

    // Идемпотентность — только для успешных холдов: повторный вызов с тем
    // же ключом возвращает тот же providerHoldId. Declined не запоминается,
    // чтобы повтор с тем же ключом на другой карте мог пройти (retry после
    // отказа банка).
    //
    // Гонка двух ПАРАЛЛЕЛЬНЫХ hold() с одним idempotencyKey: наивный
    // GET-затем-SET не атомарен — оба вызова могли бы пройти проверку
    // "холда ещё нет" и создать два разных providerHoldId. Резервируем
    // idem-ключ атомарным SET NX ДО создания холда — только один из
    // параллельных вызовов выигрывает запись; проигравший коротким
    // поллингом дожидается значения победителя и возвращает его holdId.
    const existingHoldId = await this.redis.get(this.idemKey(idempotencyKey));
    if (existingHoldId) {
      return { providerHoldId: existingHoldId, status: 'held' };
    }

    // Decline-сценарий: PAN оканчивался на 0002 — признак закодирован в
    // токене tokenizeCard() как `mockpay_tok_{last4}_...`. Не резервируем
    // idem-ключ — decline не идемпотентен, повтор с другой картой должен
    // пройти обычным путём.
    if (token.startsWith('mockpay_tok_0002_')) {
      return {
        providerHoldId: '',
        status: 'declined',
        declineReason: 'Банк отклонил операцию',
      };
    }

    const providerHoldId = `mockpay_hold_${randomUUID()}`;

    const reserved = await this.redis.set(
      this.idemKey(idempotencyKey),
      providerHoldId,
      'EX',
      HOLD_TTL_SECONDS,
      'NX',
    );

    if (reserved !== 'OK') {
      // Проиграли гонку резервации — победитель уже держит (или вот-вот
      // запишет) ключ. Короткий поллинг на случай минимального окна между
      // его NX-успехом и видимостью значения.
      for (let attempt = 0; attempt < 20; attempt++) {
        const winnerHoldId = await this.redis.get(this.idemKey(idempotencyKey));
        if (winnerHoldId) {
          return { providerHoldId: winnerHoldId, status: 'held' };
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      throw new ConflictException(
        'Не удалось определить холд-победителя идемпотентной гонки',
      );
    }

    const record: HoldRecord = {
      providerHoldId,
      token,
      amountTiyn,
      status: 'held',
    };
    await this.redis.set(
      this.holdKey(providerHoldId),
      JSON.stringify(record),
      'EX',
      HOLD_TTL_SECONDS,
    );

    return { providerHoldId, status: 'held' };
  }

  // Идемпотентность по idempotencyKey (глобальное ограничение плана E5:
  // «повторный вызов с тем же ключом у провайдера — no-op с тем же
  // результатом»): успешный capture записывает mockpay:idem:{key} ->
  // повтор с тем же ключом возвращает {status:'captured'} БЕЗ
  // ConflictException. Критично для ретрая settle/sweep: если провайдерский
  // вызов успел пройти, а наша БД-транзакция после него упала, Payment
  // остаётся HELD и повторный settle снова зовёт capture — без дедупликации
  // по ключу он навсегда упирался бы в ConflictException (холд уже не
  // 'held'). Чужой/несуществующий холд без записанного idem-ключа —
  // по-прежнему throw (переход состояния действительно невозможен).
  async capture(input: {
    idempotencyKey: string;
    providerHoldId: string;
    amountTiyn: number;
  }): Promise<{ status: 'captured' }> {
    const idemDone = await this.redis.get(this.idemKey(input.idempotencyKey));
    if (idemDone) {
      return { status: 'captured' };
    }

    const raw = await this.redis.get(this.holdKey(input.providerHoldId));
    if (!raw) {
      throw new ConflictException('Холд не найден');
    }
    const record: HoldRecord = JSON.parse(raw);
    if (record.status !== 'held') {
      throw new ConflictException(
        `Холд в статусе ${record.status}, capture невозможен`,
      );
    }
    record.status = 'captured';
    await this.redis.set(
      this.holdKey(input.providerHoldId),
      JSON.stringify(record),
      'EX',
      HOLD_TTL_SECONDS,
    );
    await this.redis.set(
      this.idemKey(input.idempotencyKey),
      input.providerHoldId,
      'EX',
      HOLD_TTL_SECONDS,
    );
    return { status: 'captured' };
  }

  // Идемпотентность void по idempotencyKey — симметрично capture (см.
  // комментарий выше).
  async void(input: {
    idempotencyKey: string;
    providerHoldId: string;
  }): Promise<{ status: 'voided' }> {
    const idemDone = await this.redis.get(this.idemKey(input.idempotencyKey));
    if (idemDone) {
      return { status: 'voided' };
    }

    const raw = await this.redis.get(this.holdKey(input.providerHoldId));
    if (!raw) {
      throw new ConflictException('Холд не найден');
    }
    const record: HoldRecord = JSON.parse(raw);
    if (record.status !== 'held') {
      throw new ConflictException(
        `Холд в статусе ${record.status}, void невозможен`,
      );
    }
    record.status = 'voided';
    await this.redis.set(
      this.holdKey(input.providerHoldId),
      JSON.stringify(record),
      'EX',
      HOLD_TTL_SECONDS,
    );
    await this.redis.set(
      this.idemKey(input.idempotencyKey),
      input.providerHoldId,
      'EX',
      HOLD_TTL_SECONDS,
    );
    return { status: 'voided' };
  }
}
