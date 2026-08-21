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
  ADMIN_API_TOKEN: Joi.string().min(24).required(),
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
});
