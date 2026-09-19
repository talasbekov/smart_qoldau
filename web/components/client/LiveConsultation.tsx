'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api/client';
import Chat from './Chat';
import Session from './Session';

export default function LiveConsultation({ consultationId, format, locale, senderRole = 'client' }: {
  consultationId: string;
  format: 'chat' | 'audio' | 'video';
  locale: string;
  senderRole?: 'client' | 'expert';
}) {
  const router = useRouter();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const kazakh = locale === 'kz';
  async function upgrade(next: 'audio' | 'video') {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setFailed(false);
    try {
      // Canonical API changes the shared format. Each participant then
      // explicitly joins with their own device consent; no automatic capture.
      await apiFetch(`consultations/${consultationId}/media-token`, {
        method: 'POST', body: JSON.stringify({ format: next }),
      });
      router.refresh();
    } catch { setFailed(true); router.refresh(); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="flex flex-col gap-4">
    <section className="rounded-2xl border border-border bg-white p-4">
      <p className="font-bold">{kazakh ? 'Байланыс форматы' : 'Формат общения'}: {format === 'chat' ? (kazakh ? 'Чат' : 'Чат') : format === 'audio' ? 'Аудио' : 'Видео'}</p>
      <p className="mt-2 text-sm text-body">{kazakh
        ? 'Чат қолжетімді. Қоңырау үшін екі қатысушы да құрылғыларын тексеріп, қосылуы керек. Формат екі жақта да жаңарады.'
        : 'Чат доступен. Для звонка оба участника проверяют устройства и нажимают «Подключиться». Выбранный формат обновится у обоих.'}</p>
      {format !== 'video' && <div className="mt-3 flex flex-wrap gap-3">
        {format === 'chat' && <button disabled={busy} onClick={() => void upgrade('audio')} className="min-h-11 rounded-xl bg-primary px-4 font-bold text-white disabled:opacity-50">{kazakh ? 'Аудиоға өту' : 'Перейти к аудио'}</button>}
        <button disabled={busy} onClick={() => void upgrade('video')} className="min-h-11 rounded-xl border border-border px-4 font-bold text-primary disabled:opacity-50">{kazakh ? 'Видеоға өту' : 'Перейти к видео'}</button>
      </div>}
      {failed && <p role="alert" className="mt-2 text-sm text-red-700">{kazakh ? 'Форматты өзгерту мүмкін болмады. Қайта көріңіз.' : 'Не удалось изменить формат. Проверьте актуальное состояние и повторите.'}</p>}
    </section>
    {format === 'chat'
      ? <div className="rounded-2xl border border-border bg-white p-4"><Chat consultationId={consultationId} locale={locale} senderRole={senderRole} /></div>
      : <Session key={`${consultationId}:${format}`} consultationId={consultationId} format={format} locale={locale} senderRole={senderRole} />}
    <p className="text-sm text-muted">{kazakh
      ? 'Қоңыраудан шығу кеңесті аяқтамайды. Кеңесті маман нәтижесін белгілеп аяқтайды; содан кейін клиент пікір қалдыра алады.'
      : 'Выход из звонка не завершает консультацию: можно подключиться снова. Специалист завершает её в своём кабинете; после этого клиент сможет оставить отзыв.'}</p>
  </div>;
}
