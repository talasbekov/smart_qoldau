import { useEffect, useState } from 'react';
import QueueTable from '@/components/QueueTable';
import DecisionModal from '@/components/DecisionModal';
import { getQueue, decideExpert, decideDocument, blockExpert, unblockExpert, type QueueEntry } from '@/lib/verification';
import { verificationSla, VERIFICATION_SLA_HOURS } from '@/lib/sla';

type ModalTarget = { kind: 'expert' | 'document'; id: string };

export default function VerificationQueuePage() {
  const [items, setItems] = useState<QueueEntry[]>([]);
  const [modalFor, setModalFor] = useState<ModalTarget | null>(null);

  async function load() {
    setItems(await getQueue());
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDecision(decision: { approve: boolean; comment?: string }) {
    if (!modalFor) return;
    if (modalFor.kind === 'expert') await decideExpert(modalFor.id, decision);
    else await decideDocument(modalFor.id, decision);
    setModalFor(null);
    await load();
  }

  async function handleBlock(expertId: string) {
    const reason = window.prompt('Причина блокировки:');
    if (!reason) return;
    await blockExpert(expertId, reason);
    await load();
  }

  async function handleUnblock(expertId: string) {
    await unblockExpert(expertId);
    await load();
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Очередь верификации</h1>
      <QueueTable
        emptyText="Очередь пуста"
        rows={items}
        columns={[
          { header: 'Эксперт', render: (r) => r.displayName },
          {
            // ТЗ §11.4: решение за 24 часа. Система срок не форсит, но
            // очередь обязана показывать оператору, что уже просрочено —
            // без этого «≤24ч» ничем не подкреплён. Бэкенд сортирует
            // очередь по submittedAt, поэтому просроченные идут сверху.
            header: 'Ждёт',
            render: (r) => {
              const sla = verificationSla(r.submittedAt);
              return (
                <span
                  className={sla.overdue ? 'text-sq-danger font-semibold' : 'text-sq-text-secondary'}
                  title={
                    sla.overdue
                      ? `Просрочка: SLA ${VERIFICATION_SLA_HOURS} ч`
                      : r.submittedAt ?? 'Отметка об отправке отсутствует'
                  }
                >
                  {sla.label}
                  {sla.overdue && ' · просрочено'}
                </span>
              );
            },
          },
          {
            header: 'Документы',
            render: (r) => (
              <div className="flex flex-col gap-1">
                {r.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-2">
                    <a href={doc.downloadUrl} target="_blank" rel="noreferrer" className="text-sq-primary">
                      {doc.type}
                    </a>
                    <span className="text-sq-text-tertiary">{doc.status}</span>
                    <button onClick={() => setModalFor({ kind: 'document', id: doc.id })} className="text-sq-primary">
                      Решение
                    </button>
                  </div>
                ))}
              </div>
            ),
          },
          {
            header: '',
            render: (r) => (
              <div className="flex gap-2">
                <button onClick={() => setModalFor({ kind: 'expert', id: r.id })} className="text-sq-primary">
                  Решение по анкете
                </button>
                <button onClick={() => handleBlock(r.id)} className="text-sq-danger">
                  Заблокировать
                </button>
                <button onClick={() => handleUnblock(r.id)} className="text-sq-text-secondary">
                  Разблокировать
                </button>
              </div>
            ),
          },
        ]}
      />
      {modalFor && (
        <DecisionModal
          title={modalFor.kind === 'expert' ? 'Решение по анкете' : 'Решение по документу'}
          requireCommentOnReject
          onSubmit={handleDecision}
          onClose={() => setModalFor(null)}
        />
      )}
    </div>
  );
}
