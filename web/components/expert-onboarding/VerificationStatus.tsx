import { Link } from '@/lib/i18n/navigation';
import { expertCopy } from './copy';
import type { ExpertMe } from './types';

export default function VerificationStatus({ expert, locale }: { expert: ExpertMe; locale: string }) {
  const copy = expertCopy(locale);
  const blocked = expert.isBlocked;
  const pending = expert.verificationStatus === 'PENDING';
  const verified = expert.verificationStatus === 'VERIFIED';
  const title = blocked ? copy.blockedTitle : pending ? copy.pendingTitle : verified ? copy.verifiedTitle : copy.draftText;
  const text = blocked ? copy.blockedText : pending ? copy.pendingText : verified ? copy.verifiedText : copy.draftText;
  const tone = blocked ? 'border-[#d98072] bg-[#fdece3] text-[#8a3a2e]' : pending ? 'border-[#e5c56c] bg-[#fff8dd] text-[#6e5812]' : verified ? 'border-[#74b69a] bg-[#e6f6ed] text-[#246b48]' : 'border-border bg-surface text-body';
  return <section className={`max-w-3xl rounded-2xl border p-5 ${tone}`} aria-live="polite">
    <h2 className="font-extrabold">{title}</h2><p className="mt-1 text-sm">{text}</p>
    <div className="mt-4 flex flex-wrap gap-3">
      <Link href="/expert/support" className="inline-flex min-h-11 items-center rounded-full border border-current px-4 text-sm font-bold">{copy.support}</Link>
      {verified && !blocked && <Link href="/expert" className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-bold text-white">{copy.dashboard}</Link>}
    </div>
  </section>;
}
