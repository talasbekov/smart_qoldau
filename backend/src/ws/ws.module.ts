import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { ExpertsModule } from '../experts/experts.module';
import { ChatModule } from '../chat/chat.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../auth/auth.module';
import { EventsGateway } from './events.gateway';
import { EventsService } from './events.service';

// @Global(): EventsService нужен requests/escalation (см. task-7-brief) без
// явного импорта WsModule в каждом потребителе. Зависимость ОДНОСТОРОННЯЯ —
// ws НЕ импортирует requests (во избежание цикла); requests импортирует ws.
// ChatModule — аналогично одностороннее (chat не импортирует ws): нужен
// EventsGateway для chat.send/chat.typing. NotificationsModule — чат-пуш
// офлайн-получателю (E9, задача 7): NotificationsModule сам НЕ импортирует
// WsModule (EventsService доступен ему через глобальный контейнер) —
// цикла нет.
//
// JwtModule сконфигурирован здесь ЛОКАЛЬНО (тот же секрет из ConfigService,
// что и AuthModule); AuthModule предоставляет общий current-state check.
@Global()
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ExpertsModule,
    ChatModule,
    NotificationsModule,
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
