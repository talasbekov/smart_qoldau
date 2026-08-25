import { useEffect, useState } from 'react';
import QueueTable from '@/components/QueueTable';
import { getFlaggedExperts, type FlaggedExpert } from '@/lib/flaggedExperts';

export default function FlaggedExpertsPage() {
  const [items, setItems] = useState<FlaggedExpert[]>([]);

  useEffect(() => {
    getFlaggedExperts({ take: 50, skip: 0 }).then(setItems);
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Эксперты с низким рейтингом (Р-20)</h1>
      <QueueTable
        emptyText="Нет экспертов ниже порога"
        rows={items}
        columns={[
          { header: 'Эксперт', render: (r) => r.displayName },
          { header: 'Рейтинг', render: (r) => r.ratingAvg.toFixed(1) },
          { header: 'Отзывов', render: (r) => String(r.ratingCount) },
        ]}
      />
    </div>
  );
}
