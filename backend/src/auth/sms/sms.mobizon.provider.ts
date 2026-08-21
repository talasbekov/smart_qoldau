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

    const data = (await response.json()) as MobizonResponse;
    if (data.code !== 0) {
      this.logger.error(
        `Mobizon SMS: отправка на ${recipient} не удалась (code=${data.code})`,
      );
      throw new Error(data.message ?? 'Mobizon SMS: отправка не удалась');
    }
  }
}
