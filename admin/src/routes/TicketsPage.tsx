import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import QueueTable from '@/components/QueueTable';
import { listTickets, type TicketSummary } from '@/lib/tickets';

export default function TicketsPage() {
  const [items, setItems] = useState<TicketSummary[]>([]);

  useEffect(() => {
    listTickets({ assigned: 'any', take: 50, skip: 0 }).then((r) => setItems(r.items));
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Тикеты</h1>
      <QueueTable
        emptyText="Нет тикетов"
        rows={items}
        columns={[
          {
            header: 'Тема',
            render: (r) => (
              <Link to={`/tickets/${r.id}`} className="text-teal-700">
                {r.subject}
              </Link>
            ),
          },
          { header: 'Статус', render: (r) => r.status },
          { header: 'Команда', render: (r) => r.team },
          { header: 'Создан', render: (r) => new Date(r.createdAt).toLocaleDateString('ru-KZ') },
        ]}
      />
    </div>
  );
}
