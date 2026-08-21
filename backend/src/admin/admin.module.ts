import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { AuditModule } from '../audit/audit.module';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminStaffController } from './admin-staff.controller';
import { AdminStaffService } from './admin-staff.service';

@Module({
  imports: [
    AuditModule,
    // JwtModule сконфигурирован здесь ЛОКАЛЬНО (тот же секрет из
    // ConfigService, что и AuthModule) — не трогаем/не расширяем AuthModule
    // ради нужд админки (аналогично WsModule).
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
  ],
  controllers: [AdminAuthController, AdminStaffController],
  providers: [AdminBootstrapService, AdminAuthService, AdminStaffService],
})
export class AdminModule {}
