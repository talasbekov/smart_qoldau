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
      <p className="text-sq-text-secondary text-sm mb-4">
        {ticket.status} · {ticket.team} · {ticket.contactEmail ?? ticket.contactPhone}
      </p>
      <p className="mb-4">{ticket.body}</p>

      <div className="flex flex-col gap-2 mb-4">
        {ticket.messages.map((m) => (
          <div key={m.id} className={`p-2 rounded ${m.authorKind === 'staff' ? 'bg-sq-surface-muted' : 'bg-sq-surface-muted'}`}>
            <div className="text-xs text-sq-text-secondary">{m.authorKind === 'staff' ? 'Сотрудник' : 'Автор'}</div>
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
        <button type="submit" className="bg-sq-primary-dark text-white rounded px-4 py-2 self-start">
          Отправить ответ
        </button>
      </form>

      <div className="flex gap-4">
        <button onClick={handleAssignToMe} className="text-sq-primary">
          Взять себе
        </button>
        {ticket.status !== 'RESOLVED' && (
          <button onClick={handleResolve} className="text-sq-danger">
            Закрыть тикет
          </button>
        )}
      </div>
    </div>
  );
}
