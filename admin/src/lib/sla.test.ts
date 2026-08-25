import { verificationSla, VERIFICATION_SLA_HOURS } from './sla';

const NOW = new Date('2026-08-26T12:00:00.000Z');

function ago(hours: number) {
  return new Date(NOW.getTime() - hours * 3_600_000).toISOString();
}

describe('verificationSla', () => {
  it('свежая заявка не просрочена, подпись в минутах', () => {
    const sla = verificationSla(ago(0.5), NOW);
    expect(sla.overdue).toBe(false);
    expect(sla.label).toBe('30 мин');
  });

  it('меньше суток — подпись в часах, всё ещё в пределах SLA', () => {
    const sla = verificationSla(ago(5), NOW);
    expect(sla.overdue).toBe(false);
    expect(sla.label).toBe('5 ч');
  });

  it('ровно 24 часа — уже просрочка (граница включительно)', () => {
    const sla = verificationSla(ago(VERIFICATION_SLA_HOURS), NOW);
    expect(sla.overdue).toBe(true);
  });

  it('23:59 — ещё НЕ просрочка', () => {
    const sla = verificationSla(ago(23.98), NOW);
    expect(sla.overdue).toBe(false);
  });

  it('больше суток — подпись в днях и часах', () => {
    const sla = verificationSla(ago(30), NOW);
    expect(sla.overdue).toBe(true);
    expect(sla.label).toBe('1 д 6 ч');
  });

  it('без отметки не выдумывает ноль часов', () => {
    expect(verificationSla(null, NOW)).toEqual({
      hoursWaiting: null,
      overdue: false,
      label: '—',
    });
    expect(verificationSla(undefined, NOW).label).toBe('—');
    expect(verificationSla('не дата', NOW).label).toBe('—');
  });
});
