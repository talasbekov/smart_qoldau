import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider } from './sms.provider';

@Injectable()
export class SmsDevProvider implements SmsProvider {
  private readonly logger = new Logger(SmsDevProvider.name);

  async send(phone: string, text: string): Promise<void> {
    this.logger.log(`SMS -> ${phone}: ${text}`);
  }
}
