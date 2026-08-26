# Веб-версия клиента (E15): тот же код, что мобильное приложение,
# собранный под браузер. Экстренный путь (Р-16) остаётся мобильным —
# см. Р-26; веб полезен для каталога, записи, материалов и подписки.
FROM ghcr.io/cirruslabs/flutter:stable AS builder
WORKDIR /build
COPY packages/shared ./packages/shared
COPY app_client ./app_client
WORKDIR /build/app_client

ARG API_BASE_URL=/v1
ARG WS_BASE_URL=
RUN flutter pub get \
 && flutter build web --release \
      --base-href=/app/ \
      --dart-define=API_BASE_URL=$API_BASE_URL \
      --dart-define=WS_BASE_URL=$WS_BASE_URL

FROM nginx:1.27-alpine AS runtime
COPY --from=builder /build/app_client/build/web /usr/share/nginx/html
COPY app_client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
