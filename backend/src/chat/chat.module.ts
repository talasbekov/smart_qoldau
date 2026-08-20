import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ExpertsModule } from '../experts/experts.module';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { MessageCipher } from './message-cipher';

@Module({
  imports: [PrismaModule, ExpertsModule],
  controllers: [ChatController],
  providers: [ChatService, MessageCipher],
  exports: [ChatService, MessageCipher],
})
export class ChatModule {}
