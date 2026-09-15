// Р-27: психолог видит имя клиента и историю встреч С НИМ.
//
// Два ограничения, которые здесь и живут:
//   * видны только консультации, прошедшие ПОСЛЕ согласия — те, что были
//     раньше, проходили под обещанием анонимности, и раскрывать их задним
//     числом нельзя;
//   * телефон не отдаётся никогда: он уводит общение из платформы и в
//     согласие не входил.

export type ConsultationRow = {
  id: string;
  startedAt: Date | null;
  endedAt: Date | null;
  status: string;
  topicSlug: string;
};

export type ClientRow = {
  id: string;
  displayName: string | null;
  phone: string | null;
};

export type ClientCard = {
  id: string;
  displayName: string;
  consultations: number;
  lastAt: Date | null;
};

export function visibleConsultations(
  rows: ConsultationRow[],
  consentAt: Date | null,
): ConsultationRow[] {
  if (!consentAt) return [];

  return rows.filter(
    (row) =>
      row.startedAt !== null && row.startedAt.getTime() >= consentAt.getTime(),
  );
}

export function toClientCard(
  client: ClientRow,
  rows: ConsultationRow[],
): ClientCard {
  const dates = rows
    .map((row) => row.startedAt)
    .filter((date): date is Date => date !== null)
    .sort((a, b) => b.getTime() - a.getTime());

  return {
    id: client.id,
    // Пустое место вместо имени читается как ошибка интерфейса;
    // нейтральное обращение честнее.
    displayName: client.displayName ?? 'Клиент',
    consultations: rows.length,
    lastAt: dates[0] ?? null,
  };
}
