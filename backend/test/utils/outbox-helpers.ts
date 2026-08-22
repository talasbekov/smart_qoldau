import { INestApplication } from '@nestjs/common';
import { OutboxSweepService } from '../../src/notifications/outbox-sweep.service';

// Веер пушей ушёл из пути запроса в очередь (E11a, задача 3): доменное
// действие теперь только ставит запись, а отправкой занимается sweep. В
// боевой среде его крутит @Interval(1000); в e2e тик прокручивается явно —
// как это уже делается с таймерами офферов (`OfferTimerService.sweep()`),
// чтобы тест не зависел от реального ожидания секунды.
export async function flushPushOutbox(app: INestApplication): Promise<number> {
  return app.get(OutboxSweepService).tick();
}
