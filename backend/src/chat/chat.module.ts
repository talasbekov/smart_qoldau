import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ConsultationsModule } from '../consultations/consultations.module';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { MessageCipher } from './message-cipher';

@Module({
  imports: [PrismaModule, ConsultationsModule],
  controllers: [ChatController],
  providers: [ChatService, MessageCipher],
  exports: [ChatService, MessageCipher],
})
export class ChatModule {}
