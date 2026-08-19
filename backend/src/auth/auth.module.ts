import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SMS_PROVIDER_TOKEN } from './sms/sms.provider';
import { SmsDevProvider } from './sms/sms.dev.provider';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: SMS_PROVIDER_TOKEN, useClass: SmsDevProvider },
  ],
})
export class AuthModule {}
