import Joi from 'joi';
import { parseTrustedProxyIps } from './trusted-proxy';

export const envValidationSchema = Joi.object({
  TRUSTED_PROXY_IPS: Joi.string()
    .allow('')
    .custom((value: string) => {
      parseTrustedProxyIps(value);
      return value;
    })
    .optional(),
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
  // Origin'ы, которым разрешён CORS к API (админка). Список через запятую;
  // по умолчанию — локальный Vite dev-сервер (см. bootstrap.ts).
  ADMIN_ORIGINS: Joi.string().optional(),
  // Поднимать ли /v1/docs. Не задан — включено везде, кроме NODE_ENV=production.
  SWAGGER_ENABLED: Joi.string().valid('true', 'false').optional(),
  S3_ENDPOINT: Joi.string().uri().required(),
  S3_ACCESS_KEY: Joi.string().required(),
  S3_SECRET_KEY: Joi.string().required(),
  S3_BUCKET_DOCUMENTS: Joi.string().default('expert-documents'),
  // Аватары специалистов — отдельный публичный бакет (E2a).
  S3_BUCKET_AVATARS: Joi.string().default('sq-avatars'),
  S3_BUCKET_CONTENT: Joi.string().default('sq-content'),
  S3_PUBLIC_BASE_URL: Joi.string().uri().optional(),
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
  // Ретенция (E11a, задача 10). Непрочитанные уведомления не удаляются
  // никогда независимо от значения.
  RETENTION_PROVIDER_EVENT_DAYS: Joi.number().default(30),
  RETENTION_NOTIFICATION_DAYS: Joi.number().default(90),
});
