import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { ExpertsModule } from '../experts/experts.module';
import { ChatModule } from '../chat/chat.module';
import { EventsGateway } from './events.gateway';
import { EventsService } from './events.service';

// @Global(): EventsService нужен requests/escalation (см. task-7-brief) без
// явного импорта WsModule в каждом потребителе. Зависимость ОДНОСТОРОННЯЯ —
// ws НЕ импортирует requests (во избежание цикла); requests импортирует ws.
// ChatModule — аналогично одностороннее (chat не импортирует ws): нужен
// EventsGateway для chat.send/chat.typing.
//
// JwtModule сконфигурирован здесь ЛОКАЛЬНО (тот же секрет из ConfigService,
// что и AuthModule) — не трогаем/не расширяем AuthModule ради WS-нужд.
@Global()
@Module({
  imports: [
    ExpertsModule,
    ChatModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [EventsGateway, EventsService],
  exports: [EventsService],
})
export class WsModule {}
