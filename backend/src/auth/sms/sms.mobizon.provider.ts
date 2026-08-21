import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsProvider } from './sms.provider';

const MOBIZON_URL = 'https://api.mobizon.kz/service/message/sendsmsmessage';
const REQUEST_TIMEOUT_MS = 10_000;

interface MobizonResponse {
  code: number;
  message?: string;
}

// Боевой адаптер SMS-порта (долг эпика E1): Mobizon REST API.
// Контракт: POST c apiKey/recipient/text в теле формы, recipient без "+";
// code !== 0 в ответе -> ошибка отправки, сообщение берём из API.
//
// ДОПУЩЕНИЕ: бриф не уточняет, куда именно кладутся apiKey/recipient/text —
// в query-строку URL или в тело POST-запроса. Здесь выбран POST body
// (application/x-www-form-urlencoded) как документированный неэкзотичный
// вариант, НЕ подтверждённый против боевого Mobizon API. Mobizon REST API
// исторически поддерживает и передачу тех же параметров через query-строку
// (даже при методе POST) — если боевой контракт окажется query-based,
// потребуется точечная правка только тела send(). Проверить фактический
// контракт перед первым включением SMS_PROVIDER=mobizon в проде.
@Injectable()
export class MobizonSmsProvider implements SmsProvider {
  private readonly logger = new Logger(MobizonSmsProvider.name);
  private readonly apiKey: string;

  constructor(config: ConfigService) {
    this.apiKey = config.getOrThrow<string>('MOBIZON_API_KEY');
  }

  async send(phone: string, text: string): Promise<void> {
    const recipient = phone.replace(/^\+/, '');
    const body = new URLSearchParams({
      apiKey: this.apiKey,
      recipient,
      text,
    });

    const response = await fetch(MOBIZON_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      this.logger.error(
        `Mobizon SMS: HTTP ${response.status} при отправке на ${recipient}`,
      );
      throw new Error(`Mobizon SMS: сервер вернул HTTP ${response.status}`);
    }

    let data: MobizonResponse;
    try {
      data = (await response.json()) as MobizonResponse;
    } catch {
      this.logger.error(
        `Mobizon SMS: невалидный JSON в ответе при отправке на ${recipient}`,
      );
      throw new Error('Mobizon SMS: невалидный ответ API (не JSON)');
    }

    if (data.code !== 0) {
      this.logger.error(
        `Mobizon SMS: отправка на ${recipient} не удалась (code=${data.code})`,
      );
      throw new Error(data.message ?? 'Mobizon SMS: отправка не удалась');
    }
  }
}
