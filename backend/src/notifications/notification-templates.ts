// Шаблоны уведомлений §5.8 (ru/kz). Код входа — SMS напрямую из E1;
// напоминание за 15 мин (Р-15) — E6 вместе с booking-слотами.
// PII-правило: НИКАКИХ имён, тем, цен и текстов сообщений в пушах —
// контент открывается в приложении за auth.

export type NotificationLocale = 'ru' | 'kz';

export const NOTIFICATION_TYPES = [
  'offer.incoming',
  'earning.credited',
  'payout.paid',
  'payout.rejected',
  'consultation.cancelled',
  'consultation.no_show_hint',
  'verification.approved',
  'verification.rejected',
  'chat.message',
  'ticket.replied',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// Критичные типы — боевой адаптер шлёт их data-only + CallKit/VoIP (обход
// DND), и только они получают SMS-fallback за 10 с без ack.
export const CRITICAL_TYPES: ReadonlySet<NotificationType> =
  new Set<NotificationType>(['offer.incoming']);

interface Template {
  title: string;
  body: string;
}

const TEMPLATES: Record<
  NotificationType,
  Record<NotificationLocale, Template>
> = {
  'offer.incoming': {
    ru: {
      title: 'Новая заявка',
      body: 'Откройте приложение, чтобы принять клиента',
    },
    kz: {
      title: 'Жаңа өтінім',
      body: 'Клиентті қабылдау үшін қосымшаны ашыңыз',
    },
  },
  'earning.credited': {
    ru: { title: 'Начисление', body: 'Вам начислено {amountTenge} ₸' },
    kz: { title: 'Есептеу', body: 'Сізге {amountTenge} ₸ есептелді' },
  },
  'payout.paid': {
    ru: {
      title: 'Выплата отправлена',
      body: 'Выплата {amountTenge} ₸ отправлена на карту {maskedPan}',
    },
    kz: {
      title: 'Төлем жіберілді',
      body: '{amountTenge} ₸ төлемі {maskedPan} картасына жіберілді',
    },
  },
  'payout.rejected': {
    ru: { title: 'Выплата отклонена', body: 'Причина: {reason}' },
    kz: { title: 'Төлем қабылданбады', body: 'Себебі: {reason}' },
  },
  'consultation.cancelled': {
    ru: {
      title: 'Консультация отменена',
      body: 'Клиент отменил консультацию',
    },
    kz: {
      title: 'Консультация тоқтатылды',
      body: 'Клиент консультациядан бас тартты',
    },
  },
  'consultation.no_show_hint': {
    ru: {
      title: 'Клиент не подключился',
      body: 'Прошло 3 минуты — решите, завершать ли консультацию',
    },
    kz: {
      title: 'Клиент қосылмады',
      body: '3 минут өтті — консультацияны аяқтау туралы шешім қабылдаңыз',
    },
  },
  'verification.approved': {
    ru: {
      title: 'Профиль подтверждён',
      body: 'Верификация пройдена — можно принимать клиентов',
    },
    kz: {
      title: 'Профиль расталды',
      body: 'Тексеру аяқталды — клиенттерді қабылдай аласыз',
    },
  },
  'verification.rejected': {
    ru: { title: 'Верификация отклонена', body: 'Подробности в приложении' },
    kz: { title: 'Тексеру қабылданбады', body: 'Толығырақ қосымшада' },
  },
  'chat.message': {
    ru: { title: 'Новое сообщение', body: 'Откройте чат консультации' },
    kz: { title: 'Жаңа хабарлама', body: 'Консультация чатын ашыңыз' },
  },
  // E8a, задача 9: ответ сотрудника поддержки на тикет автора. Ни текст
  // ответа, ни тема обращения в уведомление НЕ кладутся (PII/приватность) —
  // тема тикета это немодерируемый пользовательский текст до 200 символов,
  // который на платформе психологической поддержки может быть чувствительным,
  // а push рендерится на заблокированном экране (правило E9: имя клиента/
  // тему/цену в push не кладём). Без подстановок — только фиксированный
  // текст; ticketId (в data, не в шаблоне) открывает нужное обращение внутри
  // приложения за auth.
  'ticket.replied': {
    ru: {
      title: 'Ответ поддержки',
      body: 'По вашему обращению есть ответ',
    },
    kz: {
      title: 'Қолдау қызметінің жауабы',
      body: 'Сіздің өтінішіңіз бойынша жауап бар',
    },
  },
};

// Тенге из тиын для текста уведомления (E9, задача 6: earning.credited,
// payout.paid) — сумма всегда целое число тиын, конвертация в тенге может
// дать половину (комиссия 15% от нечётной суммы), поэтому округляем до
// целого тенге. Разделитель разрядов — обычный пробел (НЕ non-breaking
// space из Intl.NumberFormat/toLocaleString).
export function formatTenge(amountTiyn: number): string {
  const tenge = Math.round(amountTiyn / 100);
  return tenge.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// Подстановка {key} из data; неизвестная локаль падает в ru.
export function renderTemplate(
  type: NotificationType,
  locale: NotificationLocale,
  data: Record<string, unknown>,
): Template {
  const byLocale = TEMPLATES[type];
  const template = byLocale[locale] ?? byLocale.ru;
  const substitute = (text: string) =>
    text.replace(/\{(\w+)\}/g, (match, key: string) =>
      key in data ? String(data[key]) : match,
    );
  return { title: substitute(template.title), body: substitute(template.body) };
}
