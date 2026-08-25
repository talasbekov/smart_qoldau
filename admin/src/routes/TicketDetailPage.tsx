import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getTicket, replyTicket, resolveTicket, assignTicket, type TicketDetail } from '@/lib/tickets';

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [reply, setReply] = useState('');

  async function load() {
    if (!id) return;
    setTicket(await getTicket(id));
  }

  useEffect(() => {
    load();
  }, [id]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    await replyTicket(id, reply);
    setReply('');
    await load();
  }

  async function handleResolve() {
    if (!id) return;
    await resolveTicket(id);
    await load();
  }

  async function handleAssignToMe() {
    if (!id) return;
    await assignTicket(id);
    await load();
  }

  if (!ticket) return null;

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold mb-1">{ticket.subject}</h1>
      <p className="text-gray-500 text-sm mb-4">
        {ticket.status} · {ticket.team} · {ticket.contactEmail ?? ticket.contactPhone}
      </p>
      <p className="mb-4">{ticket.body}</p>

      <div className="flex flex-col gap-2 mb-4">
        {ticket.messages.map((m) => (
          <div key={m.id} className={`p-2 rounded ${m.authorKind === 'staff' ? 'bg-teal-50' : 'bg-gray-100'}`}>
            <div className="text-xs text-gray-500">{m.authorKind === 'staff' ? 'Сотрудник' : 'Автор'}</div>
            {m.body}
          </div>
        ))}
      </div>

      <form onSubmit={handleReply} className="flex flex-col gap-2 mb-4">
        <textarea
          placeholder="Ответ"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          className="border rounded px-3 py-2"
          rows={3}
          required
        />
        <button type="submit" className="bg-teal-700 text-white rounded px-4 py-2 self-start">
          Отправить ответ
        </button>
      </form>

      <div className="flex gap-4">
        <button onClick={handleAssignToMe} className="text-teal-700">
          Взять себе
        </button>
        {ticket.status !== 'RESOLVED' && (
          <button onClick={handleResolve} className="text-red-600">
            Закрыть тикет
          </button>
        )}
      </div>
    </div>
  );
}
