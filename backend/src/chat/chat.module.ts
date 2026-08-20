import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ConsultationsModule } from '../consultations/consultations.module';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { MessageCipher } from './message-cipher';

@Module({
  imports: [PrismaModule, forwardRef(() => ConsultationsModule)],
  controllers: [ChatController],
  providers: [ChatService, MessageCipher],
  exports: [ChatService, MessageCipher],
})
export class ChatModule {}
