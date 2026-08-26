# Админка — статика: собирается Vite, раздаётся nginx. Ноды в рантайме нет
# вовсе, поэтому и уязвимостей рантайма у неё нет.
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Адрес API вшивается в бандл на этапе сборки (Vite подставляет
# import.meta.env), поэтому образ админки привязан к контуру: для
# staging и прода это РАЗНЫЕ образы, а не один с разными переменными.
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
