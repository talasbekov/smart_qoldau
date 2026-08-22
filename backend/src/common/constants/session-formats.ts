// Единый список поддерживаемых форматов консультации (чат/аудио/видео).
// Вынесено по итогам ревью задачи 9 эпика E6 (раунд правок 1, п.4): список
// дублировался по отдельности в create-expert.dto, update-expert.dto,
// list-experts.dto, create-request.dto и online-count-query.dto — все они
// теперь ссылаются сюда.
export const SESSION_FORMATS = ['chat', 'audio', 'video'] as const;
export type SessionFormatValue = (typeof SESSION_FORMATS)[number];
