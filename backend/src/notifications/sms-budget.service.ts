import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClockService } from '../common/clock/clock.service';
import { RedisService } from '../redis/redis.service';

// Бюджет SMS-добивки (E11a, задача 2). Три уровня, все в Redis — счётчики
// обязаны быть общими для реплик, иначе потолок множится на их число.
//
// Зачем вообще: SMS платные, и без потолка всплеск трафика (или эксперт со
// сломанным пушем) конвертируется прямо в счёт от оператора. Существующий
// sweep E9 шлёт по одному SMS на неподтверждённый оффер — этого мало.
export type SmsBudgetLimit = 'cooldown' | 'expert_daily' | 'global_daily';

export interface SmsBudgetDecision {
  allowed: boolean;
  limit?: SmsBudgetLimit;
}

@Injectable()
export class SmsBudgetService {
  constructor(
    private redis: RedisService,
    private clock: ClockService,
    private config: ConfigService,
  ) {}

  private get cooldownSec(): number {
    return Number(this.config.get('SMS_EXPERT_COOLDOWN_SEC', '300'));
  }

  private get expertDailyMax(): number {
    return Number(this.config.get('SMS_EXPERT_DAILY_MAX', '20'));
  }

  private get globalDailyMax(): number {
    return Number(this.config.get('SMS_GLOBAL_DAILY_MAX', '2000'));
  }

  /// `true` — SMS можно отправить; бюджет при этом уже списан.
  async tryConsume(expertId: string): Promise<boolean> {
    const decision = await this.explainConsume(expertId);
    return decision.allowed;
  }

  /// То же самое, но с названием сработавшего предела: вызывающий код
  /// пишет его в audit — «превышен бюджет» без уровня не диагностируется.
  async explainConsume(expertId: string): Promise<SmsBudgetDecision> {
    const day = this.almatyDayKey();

    // Cooldown первым: он самый дешёвый и отсекает основную массу
    // повторов (эксперт со сломанным пушем и очередь офферов подряд).
    const cooldownKey = `sms:cooldown:${expertId}`;
    const acquired = await this.redis.set(
      cooldownKey,
      '1',
      'EX',
      this.cooldownSec,
      'NX',
    );
    if (acquired === null) return { allowed: false, limit: 'cooldown' };

    const expertKey = `sms:daily:${day}:${expertId}`;
    const expertCount = await this.incrWithDayTtl(expertKey);
    if (expertCount > this.expertDailyMax) {
      return { allowed: false, limit: 'expert_daily' };
    }

    const globalKey = `sms:daily:${day}:all`;
    const globalCount = await this.incrWithDayTtl(globalKey);
    if (globalCount > this.globalDailyMax) {
      return { allowed: false, limit: 'global_daily' };
    }

    return { allowed: true };
  }

  private async incrWithDayTtl(key: string): Promise<number> {
    const value = await this.redis.incr(key);
    // TTL ставится на первый инкремент: ключ суток живёт двое суток, чтобы
    // не зависеть от точности момента перевода часов и не копиться вечно.
    if (value === 1) await this.redis.expire(key, 2 * 24 * 3600);
    return value;
  }

  /// Ключ суток по Алматы (UTC+5), а не по UTC: «дневной потолок» иначе
  /// сдвигался бы на пять часов и обнулялся посреди рабочего вечера.
  /// Перехода на летнее время в Казахстане нет, поэтому фиксированное
  /// смещение корректно (тот же приём, что в matching/consultations).
  private almatyDayKey(): string {
    const almaty = new Date(this.clock.now().getTime() + 5 * 3600_000);
    return almaty.toISOString().slice(0, 10);
  }
}
