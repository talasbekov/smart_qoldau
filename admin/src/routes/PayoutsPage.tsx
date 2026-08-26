import { useEffect, useState } from 'react';
import QueueTable from '@/components/QueueTable';
import { listPayouts, approvePayout, rejectPayout, type AdminPayout } from '@/lib/payouts';

function formatTenge(tiyn: number): string {
  return `${new Intl.NumberFormat('ru-KZ').format(Math.round(tiyn / 100))} ₸`;
}

export default function PayoutsPage() {
  const [items, setItems] = useState<AdminPayout[]>([]);

  async function load() {
    const result = await listPayouts({ take: 50, skip: 0 });
    setItems(result.items);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleApprove(id: string) {
    await approvePayout(id);
    await load();
  }

  async function handleReject(id: string) {
    const reason = window.prompt('Причина отклонения:');
    if (!reason) return;
    await rejectPayout(id, reason);
    await load();
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Очередь выплат (PENDING_REVIEW)</h1>
      <QueueTable
        emptyText="Очередь пуста"
        rows={items}
        columns={[
          { header: 'Карта', render: (r) => r.maskedPan },
          { header: 'Получатель', render: (r) => r.holderName },
          { header: 'Сумма', render: (r) => formatTenge(r.amountTiyn) },
          { header: 'За месяц', render: (r) => formatTenge(r.monthTotalTiyn) },
          {
            header: '',
            render: (r) => (
              <span className="flex gap-2">
                <button onClick={() => handleApprove(r.id)} className="text-sq-primary">
                  Одобрить
                </button>
                <button onClick={() => handleReject(r.id)} className="text-sq-danger">
                  Отклонить
                </button>
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
