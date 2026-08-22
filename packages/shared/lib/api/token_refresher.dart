/// Единственный владелец обновления пары токенов сессии (`POST
/// /auth/refresh`).
library;

import '../models/models.dart';
import 'sq_api_base.dart';

/// Координирует конкурентные попытки обновить access/refresh-токен через
/// single-flight: пока один вызов [refresh] не завершился, остальные
/// получают ТОТ ЖЕ `Future`, а не запускают собственный
/// `POST /auth/refresh` поверх уже идущего.
///
/// Это критично, а не просто оптимизация: бэкенд ротирует refresh-токены
/// атомарно и ОДНОРАЗОВО (`AuthService` — условный `updateMany` по
/// `revokedAt: null`), повторное использование уже потраченного
/// refresh-токена даёт `401 UNAUTHORIZED`, а не безобидную сетевую ошибку.
/// Без координации два независимых потребителя обновления —
/// `AuthInterceptor` (реагирует на HTTP 401) и шина реалтайм-событий
/// (реагирует на разрыв WS, похожий на отказ аутентификации, — задача 8
/// эпика E6) — неизбежно устроили бы гонку за один и тот же одноразовый
/// токен, и проигравший принял бы честный `401` за смерть всей сессии
/// (см. отчёт задачи 8, раунд правок 2 — именно так и произошло до этого
/// класса).
///
/// [SqApi] создаёт РОВНО ОДИН инстанс на клиент (`SqApi.tokenRefresher`) и
/// использует его сам (внутри `AuthInterceptor`) и отдаёт наружу
/// потребителям вне HTTP-стека (см. `app_client/core/providers.dart` —
/// `connectSqEvents`). Все потребители обязаны делить ОДИН И ТОТ ЖЕ
/// объект — по конструкции своей копии `TokenRefresher` каждый получил бы
/// собственный `_inFlight` и координация снова сломалась бы.
class TokenRefresher {
  TokenRefresher(this._read, this._write, this._refreshCall);

  final TokenReader _read;
  final TokenWriter _write;

  /// Собственно HTTP-вызов — `SqApiAuth.refresh`, единственное место,
  /// строящее запрос `POST /auth/refresh`. [TokenRefresher] добавляет
  /// поверх него координацию (single-flight) и персист, а не переизобретает
  /// сам запрос — раньше `AuthInterceptor` дублировал построение этого же
  /// запроса вручную, история этого дубля описана в отчёте задачи 8.
  final Future<Tokens> Function(String refreshToken) _refreshCall;

  Future<Tokens>? _inFlight;

  /// Обновляет токены. Читает ТЕКУЩИЙ refresh-токен из хранилища в момент
  /// СТАРТА обновления (а не токен, который был на руках у вызывающего) —
  /// если к этому моменту кто-то другой уже успешно обновился, подхватится
  /// актуальное значение, а не заведомо устаревшее.
  Future<Tokens> refresh() => _inFlight ??= _doRefresh().whenComplete(() {
    _inFlight = null;
  });

  Future<Tokens> _doRefresh() async {
    final current = await _read();
    final tokens = await _refreshCall(current?.refreshToken ?? '');
    await _write(tokens);
    return tokens;
  }
}
