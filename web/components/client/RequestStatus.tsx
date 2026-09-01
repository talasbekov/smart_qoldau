'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api/client';

export type RequestState = {
  id: string;
  status: 'SEARCHING' | 'MATCHED' | 'CANCELLED' | 'NO_EXPERTS' | 'CALLBACK_REQUESTED';
  consultationId?: string | null;
  hotlines?: string[] | null;
};

// Опрос раз в пять секунд — ВРЕМЕННОЕ решение до задачи 5, где появится
// сокет: подбор придёт событием `request.matched`, и опрос уйдёт.
// Оставлять его насовсем нельзя — это лишняя нагрузка на бэкенд при
// каждой заявке и задержка до пяти секунд там, где ответ уже готов.
const POLL_MS = 5000;

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
    if (state.status === 'MATCHED' && state.consultationId) {
      router.push(`/${locale}/consultations/${state.consultationId}`);
      return;
    }
    if (state.status !== 'SEARCHING') return;

    const timer = setInterval(async () => {
      try {
        const fresh = await apiFetch<RequestState>(`requests/${requestId}`);
        if (fresh) setState(fresh);
      } catch {
        // Разрыв связи не должен ронять экран ожидания: следующая
        // попытка через пять секунд.
      }
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [state, requestId, locale, router]);

  if (state.status === 'CANCELLED') {
    return <p className="text-body">Заявка отменена</p>;
  }

  if (state.status === 'NO_EXPERTS' || state.status === 'CALLBACK_REQUESTED') {
    return (
      <div>
        <h1 className="mb-2 text-xl font-extrabold text-ink">
          Сейчас никого свободного нет
        </h1>
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
      <h1 className="mb-2 text-xl font-extrabold text-ink">
        Ищем свободного специалиста для вас
      </h1>
      <p className="text-sm text-muted" aria-live="polite">
        Обычно это занимает одну–две минуты. Страницу можно не закрывать.
      </p>
    </div>
  );
}
