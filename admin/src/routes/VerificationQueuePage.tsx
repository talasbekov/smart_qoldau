import { useEffect, useState } from 'react';
import QueueTable from '@/components/QueueTable';
import DecisionModal from '@/components/DecisionModal';
import { getQueue, decideExpert, decideDocument, blockExpert, unblockExpert, type QueueEntry } from '@/lib/verification';

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
            header: 'Документы',
            render: (r) => (
              <div className="flex flex-col gap-1">
                {r.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-2">
                    <a href={doc.downloadUrl} target="_blank" rel="noreferrer" className="text-teal-700">
                      {doc.type}
                    </a>
                    <span className="text-gray-400">{doc.status}</span>
                    <button onClick={() => setModalFor({ kind: 'document', id: doc.id })} className="text-teal-700">
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
                <button onClick={() => setModalFor({ kind: 'expert', id: r.id })} className="text-teal-700">
                  Решение по анкете
                </button>
                <button onClick={() => handleBlock(r.id)} className="text-red-600">
                  Заблокировать
                </button>
                <button onClick={() => handleUnblock(r.id)} className="text-gray-600">
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
