/// Выбор адреса бэкенда для HTTP и реалтайм-шины.
library;

/// Собирает адрес бэкенда из трёх источников, в порядке убывания
/// приоритета: сборочный `--dart-define`, origin открытой страницы (web),
/// запасной адрес для мобильных.
///
/// Почему origin, а не только `--dart-define`: значение
/// `String.fromEnvironment` фиксируется в момент `flutter build web`, и
/// веб-бандл получается намертво привязан к адресу, действовавшему при
/// сборке. Стенд на этом уже обжигался — бандл, собранный с адресом
/// временного туннеля, после его отключения отдавал «Нет соединения с
/// сервером» на первом же экране входа, хотя бэкенд был жив. За прокси
/// приложение и API всегда на одном источнике (`/v1` и `/socket.io/`
/// проксируются туда же, см. `infra/nginx.stand.conf`), поэтому origin
/// страницы — верный адрес по построению, при любой смене ссылки.
///
/// [fromDefine] — значение `--dart-define`; пустая строка означает «не
/// задан». [pageUri] — `Uri.base`, [isWeb] — `kIsWeb` (оба передаются
/// снаружи, чтобы функция оставалась чистой и проверялась без браузера).
/// [path] дописывается к origin: `/v1` для HTTP-клиента и пустая строка
/// для шины (`SocketIoSqSocket` сам добавляет неймспейс `/ws`).
///
/// Оговорка для `flutter run -d chrome`: там origin — адрес dev-сервера,
/// на котором API нет, поэтому в этом режиме адрес по-прежнему задают
/// явным `--dart-define`.
String resolveBackendBaseUrl({
  required String fromDefine,
  required bool isWeb,
  required Uri pageUri,
  required String mobileFallback,
  required String path,
}) {
  if (fromDefine.isNotEmpty) return fromDefine;
  if (isWeb) return '${pageUri.origin}$path';
  return mobileFallback;
}
