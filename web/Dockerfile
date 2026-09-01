# Debian, а не Alpine, намеренно. Next тянет нативные пакеты (sharp,
# lightningcss), и на musl npm требует их wasm-вариантов (@emnapi/*),
# которых нет в package-lock.json — он снят на glibc. Пересобирать лок под
# musl значит сломать установку на машинах разработчиков; проще взять базу
# той же libc, что у всех остальных.
FROM node:24-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Каталога public в проекте нет (иконки и og-картинки отдаёт сам Next из
# app/), но standalone-рантайм ожидает его существования. Пустая папка
# дешевле условного копирования, которого в Dockerfile всё равно нет.
RUN mkdir -p public && npm run build

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Без этого standalone-сервер Next слушает на имени контейнера, а не на
# всех интерфейсах: снаружи он доступен, а healthcheck по 127.0.0.1 —
# нет, и контейнер вечно числится unhealthy.
ENV HOSTNAME=0.0.0.0
# standalone-сборка Next: сервер и ровно те зависимости, что ему нужны.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
