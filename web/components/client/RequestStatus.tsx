'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { connectRealtime, type SqSocket } from '@/lib/realtime/socket';

export type RequestState = {
  id: string;
  status: 'SEARCHING' | 'MATCHED' | 'CANCELLED' | 'NO_EXPERTS' | 'CALLBACK_REQUESTED';
  consultationId?: string | null;
  hotlines?: string[] | null;
};

export default function RequestStatus({
  requestId,
  initial,
  locale,
}: {
  requestId: string;
  initial: RequestState;
  locale: string;
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);

  useEffect(() => {
    if (state.status !== 'SEARCHING') return;

    let socket: SqSocket | null = null;
    let dropped = false;

    void (async () => {
      try {
        const connected = await connectRealtime();
        if (dropped) {
          connected.close();
          return;
        }
        socket = connected;
        connected.on('request.updated', (payload) => {
          const fresh = payload as RequestState;
          // Комната адресована пользователю, а заявок у него может быть
          // несколько за сессию — чужое событие игнорируем.
          if (fresh.id === requestId) setState(fresh);
        });
      } catch {
        // Подключиться не удалось — экран остаётся на месте и говорит,
        // что идёт поиск. Хуже было бы показать ошибку человеку, который
        // ждёт помощи: заявка при этом жива.
      }
    })();

    return () => {
      dropped = true;
      socket?.close();
    };
  }, [state.status, requestId]);

  useEffect(() => {
    if (state.status === 'MATCHED' && state.consultationId) {
      router.push(`/${locale}/consultations/${state.consultationId}`);
    }
  }, [state, locale, router]);

  if (state.status === 'CANCELLED') {
    return <p className="text-body">Заявка отменена</p>;
  }

  if (state.status === 'NO_EXPERTS' || state.status === 'CALLBACK_REQUESTED') {
    return (
      <div>
        <h1 className="mb-2 text-xl font-extrabold text-ink">Сейчас никого свободного нет</h1>
        <p className="mb-4 text-sm text-body">
          Мы напишем, как только специалист освободится. Если помощь нужна прямо сейчас —
          позвоните:
        </p>
        <ul className="flex flex-wrap gap-3">
          {(state.hotlines ?? ['150', '103', '112']).map((number) => (
            <li key={number}>
              <a
                href={`tel:${number}`}
                className="inline-block rounded-xl bg-chip px-4 py-2 text-sm font-bold text-ink underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {number}
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-2 text-xl font-extrabold text-ink">Ищем свободного специалиста для вас</h1>
      <p className="text-sm text-muted" aria-live="polite">
        Обычно это занимает одну–две минуты. Страницу можно не закрывать.
      </p>
    </div>
  );
}
