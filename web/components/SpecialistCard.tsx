import type { ExpertPublic } from '@/lib/api';

function formatTenge(priceTiyn: number): string {
  return `${new Intl.NumberFormat('ru-KZ').format(Math.round(priceTiyn / 100))} ₸`;
}

export default function SpecialistCard({ expert }: { expert: ExpertPublic }) {
  return (
    <div className="bg-white rounded-2xl border border-border p-6">
      <div className="w-16 h-16 rounded-full bg-chip mb-4" />
      <div className="font-extrabold text-ink text-[15.5px]">{expert.displayName}</div>
      <div className="text-faint text-xs mb-2">Психолог · {expert.city}</div>
      <div className="font-bold text-ink text-sm mb-2">⭐ {expert.ratingAvg.toFixed(1)}</div>
      <div className="flex items-center justify-between">
        <div className="font-extrabold text-ink text-sm">{formatTenge(expert.priceTiyn)}</div>
      </div>
    </div>
  );
}
