# Упаковка уже собранного веб-бандла в nginx.
#
# Почему не многоступенчатая сборка с образом Flutter: опубликованные
# образы (ghcr.io/cirruslabs/flutter) отстают от SDK проекта — на
# 2026-08-27 там 3.29, а проекту нужен Dart ^3.13.1 из Flutter 3.47.
# Сборка с ними падает на version solving. Бандл собирается там, где
# нужный SDK уже стоит (машина разработчика или CI с setup-flutter):
#
#   cd app_expert && flutter build web --release --base-href=/PREFIX/ \
#     --dart-define=API_BASE_URL=... --dart-define=WS_BASE_URL=...
#
# Точную команду см. в README-web.md.
FROM nginx:1.27-alpine
COPY app_expert/build/web /usr/share/nginx/html
COPY app_expert/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
