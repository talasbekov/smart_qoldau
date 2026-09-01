import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ClockModule } from '../common/clock/clock.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

// Удаление аккаунта по запросу (ТЗ §5.1). Отдельный модуль, а не метод в
// devices/auth: удаление трогает данные почти всех модулей и должно быть
// видно в структуре проекта, а не спрятано в соседнем контроллере.
@Module({
  imports: [PrismaModule, AuditModule, ClockModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
