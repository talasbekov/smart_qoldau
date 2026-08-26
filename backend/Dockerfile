# Многоступенчатая сборка: в рантайм-образ не попадают ни исходники, ни
# dev-зависимости. Это не эстетика — среди dev-зависимостей живёт prisma
# CLI, единственный источник оставшихся уязвимостей аудита (см. README,
# «Зависимости»), и в бою ему делать нечего.

# --- Сборка -----------------------------------------------------------
FROM node:24-alpine AS builder
WORKDIR /app

# Слои кэшируются по манифестам: правка исходников не тянет за собой
# переустановку зависимостей.
COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
# Клиент Prisma генерируется из схемы и обязан попасть в образ: без него
# приложение падает на первом же запросе к базе.
RUN npx prisma generate

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# --- Рантайм ----------------------------------------------------------
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Только прод-зависимости. @prisma/client среди них уже есть — копировать
# его из сборочного слоя поверх значило бы держать в образе две копии по
# 77 МБ. А вот сгенерированный клиент (node_modules/.prisma) npm не
# создаёт: его postinstall молча пропускается, потому что prisma CLI —
# dev-зависимость и в рантайм-образ не ставится. Поэтому копируется
# только он.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
# Миграции нужны в образе: их применяет отдельный шаг развёртывания
# (см. infra/docker-compose.prod.yml, сервис `migrate`), а не сам API —
# иначе несколько реплик стартуют и накатывают схему одновременно.
COPY --from=builder /app/prisma ./prisma

# Своим пользователем, а не root: контейнер, пробитый через загрузку
# файлов, не должен получать права на весь образ.
USER node

EXPOSE 3000
# Тот же путь, что проверяет спек health.e2e-spec: если он отвечает,
# приложение подняло модули и достучалось до зависимостей.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main"]
