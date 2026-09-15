import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuditModule } from '../audit/audit.module';
import { AccountAccessService } from './account-access.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { SMS_PROVIDER_TOKEN, SmsProvider } from './sms/sms.provider';
import { SmsDevProvider } from './sms/sms.dev.provider';
import { MobizonSmsProvider } from './sms/sms.mobizon.provider';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>(
            'JWT_ACCESS_TTL',
          ) as JwtModuleOptions['signOptions']['expiresIn'],
        },
      }),
    }),
    AuditModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccountAccessService,
    JwtStrategy,
    {
      provide: SMS_PROVIDER_TOKEN,
      // Фабрика по SMS_PROVIDER: 'mobizon' -> боевой адаптер (долг E1),
      // иначе -> dev-провайдер (лог вместо реальной отправки).
      useFactory: (config: ConfigService): SmsProvider =>
        config.get<string>('SMS_PROVIDER') === 'mobizon'
          ? new MobizonSmsProvider(config)
          : new SmsDevProvider(),
      inject: [ConfigService],
    },
  ],
  // SMS_PROVIDER_TOKEN нужен и вне auth — SMS-fallback критичных
  // уведомлений (E9, задача 5) шлёт добивку тем же портом/провайдером.
  exports: [SMS_PROVIDER_TOKEN, AccountAccessService],
})
export class AuthModule {}
