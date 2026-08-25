// SLA очереди верификации: ТЗ §11.4 обещает эксперту решение за 24 часа.
// Само по себе обещание процессное — система его не форсит, но оператор
// обязан видеть, какие заявки уже просрочены и какая ждёт дольше всех.
export const VERIFICATION_SLA_HOURS = 24;

export interface SlaState {
  /** Сколько часов заявка уже ждёт (дробное). null — отметки нет. */
  hoursWaiting: number | null;
  overdue: boolean;
  /** Готовая подпись для ячейки очереди. */
  label: string;
}

// submittedAt приходит из API строкой ISO; null у записей, отправленных
// до появления поля verification_submitted_at — для них считать нечего,
// и врать «0 часов» нельзя.
export function verificationSla(
  submittedAt: string | null | undefined,
  now: Date = new Date(),
): SlaState {
  if (!submittedAt) {
    return { hoursWaiting: null, overdue: false, label: '—' };
  }

  const submitted = new Date(submittedAt);
  if (Number.isNaN(submitted.getTime())) {
    return { hoursWaiting: null, overdue: false, label: '—' };
  }

  const hoursWaiting = (now.getTime() - submitted.getTime()) / 3_600_000;
  const overdue = hoursWaiting >= VERIFICATION_SLA_HOURS;

  if (hoursWaiting < 1) {
    const minutes = Math.max(0, Math.floor(hoursWaiting * 60));
    return { hoursWaiting, overdue, label: `${minutes} мин` };
  }

  const hours = Math.floor(hoursWaiting);
  if (hours < 24) return { hoursWaiting, overdue, label: `${hours} ч` };

  const days = Math.floor(hours / 24);
  return { hoursWaiting, overdue, label: `${days} д ${hours % 24} ч` };
}
