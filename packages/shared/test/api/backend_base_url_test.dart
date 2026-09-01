/// Выбор адреса бэкенда: сборочный `--dart-define` перекрывает всё, на web
/// без него адрес берётся из origin открытой страницы, на мобильных —
/// фиксированный запасной адрес.
///
/// Тест закрывает баг стенда: веб-бандл, собранный с адресом временного
/// туннеля, продолжал стучаться в него и после того, как туннель погас, —
/// экран входа отдавал «Нет соединения с сервером» ещё до сети.
library;

import 'package:shared/shared.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('resolveBackendBaseUrl', () {
    test('сборочный dart-define перекрывает и web, и мобильный запасной', () {
      expect(
        resolveBackendBaseUrl(
          fromDefine: 'https://api.smartqoldau.kz/v1',
          isWeb: true,
          pageUri: Uri.parse('https://stand.example.com/expert/'),
          mobileFallback: 'http://10.0.2.2:3000/v1',
          path: '/v1',
        ),
        'https://api.smartqoldau.kz/v1',
      );
    });

    test('на web без define адрес берётся из origin страницы', () {
      expect(
        resolveBackendBaseUrl(
          fromDefine: '',
          isWeb: true,
          pageUri: Uri.parse('http://localhost:8080/expert/offers'),
          mobileFallback: 'http://10.0.2.2:3000/v1',
          path: '/v1',
        ),
        'http://localhost:8080/v1',
      );
    });

    test('origin не тянет за собой путь, порт и схему сохраняет', () {
      expect(
        resolveBackendBaseUrl(
          fromDefine: '',
          isWeb: true,
          pageUri: Uri.parse('https://stand.example.com:8443/app/login?x=1'),
          mobileFallback: 'http://10.0.2.2:3000',
          path: '',
        ),
        'https://stand.example.com:8443',
      );
    });

    test('вне web без define остаётся мобильный запасной адрес', () {
      expect(
        resolveBackendBaseUrl(
          fromDefine: '',
          isWeb: false,
          pageUri: Uri.parse('http://localhost:8080/'),
          mobileFallback: 'http://10.0.2.2:3000/v1',
          path: '/v1',
        ),
        'http://10.0.2.2:3000/v1',
      );
    });
  });
}
