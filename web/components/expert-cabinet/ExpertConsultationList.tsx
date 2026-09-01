import Link from 'next/link';
import type { components } from '@/lib/api/generated';
import type { Topic } from '@/lib/api/public';

type ExpertConsultation = components['schemas']['ConsultationExpertDto'];

const FORMAT_LABELS: Record<string, string> = { chat: 'Чат', audio: 'Аудио', video: 'Видео' };
const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Запланирована',
  ACTIVE: 'Идёт сейчас',
  COMPLETED: 'Завершена',
  CANCELLED: 'Отменена',
};

// Р-03: платформа удерживает 15 % полной цены. Эксперту показываем то,
// что он получит, — цена для клиента ему ни о чём не говорит.
const COMMISSION = 0.15;

function tenge(tiyn: number): string {
  return `${new Intl.NumberFormat('ru-KZ').format(Math.round(tiyn / 100))} ₸`;
}

function when(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('ru-KZ', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Card({
  item,
  topicNames,
  locale,
}: {
  item: ExpertConsultation;
  topicNames: Map<string, string>;
  locale: string;
}) {
  return (
    <li className="rounded-[20px] border border-border bg-white p-5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[15px] font-extrabold text-ink">
          {topicNames.get(item.topicSlug) ?? item.topicSlug}
        </span>
        {item.isEmergency && (
          <span className="rounded-full bg-chip px-3 py-1 text-xs font-bold text-ink">Срочная</span>
        )}
      </div>
      {/* Код, а не имя: инвариант продукта, а не оформление. */}
      <p className="mb-2 text-xs text-faint">
        Клиент №{item.clientCode} · {FORMAT_LABELS[item.format] ?? item.format} ·{' '}
        {when(item.startedAt)}
      </p>
      <p className="mb-3 text-sm font-semibold text-ink">
        {STATUS_LABELS[item.status] ?? item.status} ·{' '}
        {tenge(Math.round(item.priceTiyn * (1 - COMMISSION)))}
      </p>
      <Link
        href={`/${locale}/expert/consultations/${item.id}`}
        className="rounded-xl px-3 py-2 text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
      >
        Открыть
      </Link>
    </li>
  );
}

export default function ExpertConsultationList({
  items,
  topics,
  locale,
}: {
  items: ExpertConsultation[];
  topics: Topic[];
  locale: string;
}) {
  if (items.length === 0) {
    return <p className="py-12 text-body">Консультаций пока нет</p>;
  }

  const topicNames = new Map(topics.map((t) => [t.slug, t.name]));
  const upcoming = items.filter((i) => i.status === 'SCHEDULED' || i.status === 'ACTIVE');
  const past = items.filter((i) => i.status === 'COMPLETED' || i.status === 'CANCELLED');

  return (
    <div className="flex flex-col gap-8">
      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-extrabold text-ink">Предстоящие</h2>
          <ul className="flex flex-col gap-3">
            {upcoming.map((item) => (
              <Card key={item.id} item={item} topicNames={topicNames} locale={locale} />
            ))}
          </ul>
        </section>
      )}
      {past.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-extrabold text-ink">Прошедшие</h2>
          <ul className="flex flex-col gap-3">
            {past.map((item) => (
              <Card key={item.id} item={item} topicNames={topicNames} locale={locale} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
