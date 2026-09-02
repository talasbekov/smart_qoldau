'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api/client';
import { connectRealtime, type SqSocket } from '@/lib/realtime/socket';

type Message = {
  id: string;
  consultationId: string;
  senderRole: 'CLIENT' | 'EXPERT';
  text: string;
  createdAt: string;
};

const ERRORS: Record<string, string> = {
  CONSULTATION_NOT_ACTIVE: 'Консультация завершена — написать больше нельзя',
  MESSAGE_TOO_LONG: 'Сообщение слишком длинное',
  CHAT_RATE_LIMITED: 'Слишком часто. Подождите пару секунд',
};

export default function Chat({ consultationId }: { consultationId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<SqSocket | null>(null);

  // Добавление через Map по id: одно и то же сообщение приходит и
  // историей, и сокетом — например, когда история догрузилась позже
  // события. Проверка по id дешевле любой эвристики по тексту.
  function add(incoming: Message[]) {
    setMessages((current) => {
      const byId = new Map(current.map((m) => [m.id, m]));
      for (const message of incoming) byId.set(message.id, message);
      return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });
  }

  useEffect(() => {
    let dropped = false;

    void (async () => {
      const history = await apiFetch<{ items: Message[] }>(
        `consultations/${consultationId}/messages`,
      ).catch(() => null);
      if (!dropped && history?.items) add(history.items);
    })();

    void (async () => {
      try {
        const socket = await connectRealtime();
        if (dropped) {
          socket.close();
          return;
        }
        socketRef.current = socket;

        socket.on('chat.message', (payload) => {
          const message = payload as Message;
          // Комната адресована пользователю: у него может идти не одна
          // консультация, чужие сообщения сюда попадать не должны.
          if (message.consultationId === consultationId) add([message]);
        });
        socket.on('chat.error', (payload) => {
          const code = (payload as { code?: string }).code;
          setError((code && ERRORS[code]) || 'Сообщение не отправлено');
        });
      } catch {
        setError('Нет связи с чатом. Проверьте подключение');
      }
    })();

    return () => {
      dropped = true;
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [consultationId]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    setError(null);
    socketRef.current?.send('chat.send', { consultationId, text });
    setDraft('');
  }

  return (
    <div className="flex h-full min-h-[320px] flex-col">
      <ul
        role="log"
        aria-live="polite"
        aria-label="Переписка"
        className="flex flex-1 flex-col gap-2 overflow-y-auto p-1"
      >
        {messages.map((message) => (
          <li
            key={message.id}
            className={
              message.senderRole === 'CLIENT'
                ? 'max-w-[80%] self-end rounded-2xl bg-primary px-4 py-2 text-sm text-white'
                : 'max-w-[80%] self-start rounded-2xl bg-chip px-4 py-2 text-sm text-ink'
            }
          >
            {message.text}
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="px-1 py-2 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      <form onSubmit={submit} className="mt-3 flex gap-2">
        <label htmlFor="chat-draft" className="sr-only">
          Сообщение
        </label>
        <input
          id="chat-draft"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Напишите сообщение"
          className="h-12 flex-1 rounded-2xl border border-border px-4 text-base text-ink focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          className="h-12 rounded-2xl bg-primary px-5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          Отправить
        </button>
      </form>
    </div>
  );
}
