// Р-27: психолог видит имя и историю встреч клиента. Согласие
// спрашивается ОДИН раз — перед первой заявкой.
//
// Хранится время согласия, а не флаг: нужно уметь ответить, когда и на
// что человек согласился, и отделить консультации, проведённые ДО него —
// они проходили под обещанием анонимности и остаются под кодом клиента.
export const MAX_DISPLAY_NAME = 64;

export function needsExpertVisibilityConsent(user: {
  expertVisibilityAcceptedAt: Date | null;
}): boolean {
  return user.expertVisibilityAcceptedAt === null;
}
