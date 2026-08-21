import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LedgerService } from './ledger.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
