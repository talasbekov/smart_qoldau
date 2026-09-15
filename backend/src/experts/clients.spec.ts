import { visibleConsultations, toClientCard } from './clients';

const consultation = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  startedAt: new Date('2026-09-05T10:00:00.000Z'),
  endedAt: new Date('2026-09-05T11:00:00.000Z'),
  status: 'COMPLETED',
  topicSlug: 'burnout',
  ...over,
});

describe('видимые эксперту консультации (Р-27)', () => {
  const consentAt = new Date('2026-09-01T00:00:00.000Z');

  it('показывает консультации, прошедшие ПОСЛЕ согласия', () => {
    const visible = visibleConsultations([consultation()], consentAt);

    expect(visible).toHaveLength(1);
  });

  it('НЕ показывает консультации, прошедшие ДО согласия', () => {
    // Они проходили под обещанием анонимности. Раскрыть их задним числом
    // — нарушить обещание, данное в момент обращения.
    const visible = visibleConsultations(
      [consultation({ startedAt: new Date('2026-08-20T10:00:00.000Z') })],
      consentAt,
    );

    expect(visible).toEqual([]);
  });

  it('без согласия не показывает ничего', () => {
    expect(visibleConsultations([consultation()], null)).toEqual([]);
  });

  it('консультацию ровно в момент согласия считает разрешённой', () => {
    const visible = visibleConsultations(
      [consultation({ startedAt: consentAt })],
      consentAt,
    );

    expect(visible).toHaveLength(1);
  });
});

describe('карточка клиента', () => {
  it('содержит имя и число встреч', () => {
    const card = toClientCard(
      { id: 'u1', displayName: 'Айгерим', phone: '+77010000000' },
      [consultation(), consultation({ id: 'c2' })],
    );

    expect(card).toMatchObject({
      id: 'u1',
      displayName: 'Айгерим',
      consultations: 2,
    });
  });

  it('НЕ содержит телефон ни в каком виде', () => {
    const card = toClientCard(
      { id: 'u1', displayName: 'Айгерим', phone: '+77010000000' },
      [consultation()],
    );

    // Телефон уводит общение из платформы и не входит в согласие.
    expect(JSON.stringify(card)).not.toContain('7701');
    expect(JSON.stringify(card)).not.toContain('phone');
  });

  it('без имени подставляет нейтральное обращение, а не пустоту', () => {
    const card = toClientCard({ id: 'u1', displayName: null, phone: null }, []);

    expect(card.displayName).toBe('Клиент');
  });

  it('помнит дату последней встречи', () => {
    const card = toClientCard(
      { id: 'u1', displayName: 'Айгерим', phone: null },
      [
        consultation({ startedAt: new Date('2026-09-01T10:00:00.000Z') }),
        consultation({
          id: 'c2',
          startedAt: new Date('2026-09-10T10:00:00.000Z'),
        }),
      ],
    );

    expect(card.lastAt).toEqual(new Date('2026-09-10T10:00:00.000Z'));
  });
});
