import Joi from 'joi';

export const envValidationSchema = Joi.object({
  DATABASE_URL: Joi.string().uri().required(),
  REDIS_URL: Joi.string().uri().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: Joi.number().default(30),
  SMS_PROVIDER: Joi.string().valid('dev', 'mobizon').default('dev'),
  MOBIZON_API_KEY: Joi.string().when('SMS_PROVIDER', {
    is: 'mobizon',
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  S3_ENDPOINT: Joi.string().uri().required(),
  S3_ACCESS_KEY: Joi.string().required(),
  S3_SECRET_KEY: Joi.string().required(),
  S3_BUCKET_DOCUMENTS: Joi.string().default('expert-documents'),
  // Опциональны: заданы оба — при пустой таблице admin_users сид создаст
  // первого суперадмина (AdminBootstrapService). Не заданы — сид просто
  // пропускается, боевой деплой без сида законен.
  ADMIN_BOOTSTRAP_EMAIL: Joi.string().email().optional(),
  ADMIN_BOOTSTRAP_PASSWORD: Joi.string().min(12).optional(),
  CHAT_ENCRYPTION_KEY: Joi.string().hex().length(64).required(),
  LIVEKIT_API_KEY: Joi.string().required(),
  LIVEKIT_API_SECRET: Joi.string().required(),
  LIVEKIT_URL: Joi.string().uri().default('ws://localhost:7880'),
  PAYMENT_PROVIDER: Joi.string().valid('mock').default('mock'),
  PUSH_PROVIDER: Joi.string().valid('mock').default('mock'),
  PAYMENT_WEBHOOK_SECRET: Joi.string().min(32).required(),
  PAYOUT_WEBHOOK_SECRET: Joi.string().min(32).required(),
  // Точечный выключатель лимитов для спеков, которые честно делают десятки
  // запросов подряд (нагрузочные и сквозные). В боевой среде — всегда true.
  THROTTLE_ENABLED: Joi.string().valid('true', 'false').default('true'),
  // Бюджет платных SMS-добивок (E11a, задача 2). Значения — потолки, а не
  // цели: нормальный день до них не доходит.
  SMS_EXPERT_COOLDOWN_SEC: Joi.number().default(300),
  SMS_EXPERT_DAILY_MAX: Joi.number().default(20),
  SMS_GLOBAL_DAILY_MAX: Joi.number().default(2000),
  // Сколько секунд живёт кэш актуальности сотрудника (E11a, задача 4).
  // Верхняя граница задержки отзыва доступа: деактивация сбрасывает кэш
  // сама, TTL страхует случаи правки в обход API.
  ADMIN_CHECK_CACHE_SEC: Joi.number().default(30),
  // Требовать ли второй фактор от всех сотрудников (E11a, задача 5).
  // В dev по умолчанию false, в проде обязан быть true: сотрудник без
  // привязанной 2FA тогда видит только маршруты привязки.
  TOTP_REQUIRED: Joi.string().valid('true', 'false').default('false'),
});
