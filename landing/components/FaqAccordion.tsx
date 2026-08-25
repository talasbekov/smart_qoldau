'use client';

import { useState } from 'react';

interface Faq {
  question: string;
  answer: string;
}

export default function FaqAccordion({ faqs }: { faqs: Faq[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-2">
      {faqs.map((faq, i) => (
        <div key={faq.question} className="bg-white rounded-2xl border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
          >
            <span className="font-bold text-ink text-sm flex-1">{faq.question}</span>
            <span className="w-5 h-5 rounded-full bg-[#f2f2f0] flex items-center justify-center text-sm font-bold text-body flex-shrink-0">
              {openIndex === i ? '−' : '+'}
            </span>
          </button>
          {openIndex === i && (
            <div className="px-5 pb-4 text-body text-sm leading-relaxed">{faq.answer}</div>
          )}
        </div>
      ))}
    </div>
  );
}
