import Link from 'next/link';
import type { components } from '@/lib/api/generated';

export type PremiumStatus = components['schemas']['PremiumStatusDto'];

function date(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ru-KZ', { day: 'numeric', month: 'long' });
}

export default function PremiumCard({
  status,
  locale,
}: {
  status: PremiumStatus;
  locale: string;
}) {
  if (!status.active) {
    return (
      <section className="rounded-[20px] border border-border bg-white p-6">
        <h2 className="mb-2 text-lg font-extrabold text-ink">Premium</h2>
        <p className="mb-4 text-sm text-body">
          Скидка на консультации и приоритетный подбор специалиста.
        </p>
        {/* Цена не зашивается сюда: она живёт на публичной странице
            тарифов, а расхождение прототипа по цене ещё не закрыто. */}
        <Link
          href={`/${locale}/premium`}
          className="inline-block rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          Подключить Premium
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-[20px] border border-border bg-white p-6">
      <h2 className="mb-2 text-lg font-extrabold text-ink">Premium подключён</h2>

      {status.inGrace && (
        <p role="alert" className="mb-3 rounded-2xl bg-chip p-4 text-sm text-body">
          Не удалось списать оплату — проверьте карту. Доступ сохраняется, пока мы
          повторяем попытки.
        </p>
      )}

      <p className="text-sm text-body">
        {status.cancelled
          ? // Р-09: отменённая подписка работает до конца оплаченного
            // периода. Умолчать об этом — гарантированное обращение в
            // поддержку «я отменил, а деньги за что».
            `Подписка отменена, доступ сохраняется до ${date(status.currentPeriodEnd)}`
          : `Действует до ${date(status.currentPeriodEnd)}`}
      </p>
    </section>
  );
}
