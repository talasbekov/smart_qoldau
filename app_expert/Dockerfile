# Кабинет эксперта под веб (E14). Собирается тем же кодом, что мобильное
# приложение: отдельного веб-приложения в проекте нет, различаются только
# раскладки (SqLayout по ширине окна).
FROM ghcr.io/cirruslabs/flutter:stable AS builder
WORKDIR /build

# Общий пакет копируется целиком: app_expert зависит от него по пути.
COPY packages/shared ./packages/shared
COPY app_expert ./app_expert
WORKDIR /build/app_expert

# Адрес API вшивается в бандл на этапе сборки, как и у админки: образ
# привязан к контуру, для другого нужен свой.
ARG API_BASE_URL=/v1
ARG WS_BASE_URL=
RUN flutter pub get \
 && flutter build web --release \
      --base-href=/expert/ \
      --dart-define=API_BASE_URL=$API_BASE_URL \
      --dart-define=WS_BASE_URL=$WS_BASE_URL

FROM nginx:1.27-alpine AS runtime
COPY --from=builder /build/app_expert/build/web /usr/share/nginx/html
COPY app_expert/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
