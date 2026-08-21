import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider } from './sms.provider';

@Injectable()
export class SmsDevProvider implements SmsProvider {
  private readonly logger = new Logger(SmsDevProvider.name);

  constructor() {
    this.logger.warn(
      'SmsDevProvider активен: SMS не отправляются, только логируются (dev-only, не использовать в проде — SMS_PROVIDER=mobizon)',
    );
  }

  async send(phone: string, text: string): Promise<void> {
    this.logger.log(`SMS -> ${phone}: ${text}`);
  }
}
