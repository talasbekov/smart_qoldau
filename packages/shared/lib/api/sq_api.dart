import 'package:dio/dio.dart';

import 'auth_interceptor.dart';
import 'sq_api_auth.dart';
import 'sq_api_base.dart';
import 'sq_api_consultations.dart';
import 'sq_api_documents.dart';
import 'sq_api_expert_profile.dart';
import 'sq_api_experts.dart';
import 'sq_api_notifications.dart';
import 'sq_api_offers.dart';
import 'sq_api_payments.dart';
import 'sq_api_requests.dart';
import 'sq_api_schedule.dart';
import 'sq_api_tickets.dart';
import 'token_refresher.dart';

/// Типизированный клиент к бэкенду SmartQoldau.
///
/// Методы сгруппированы по модулям бэкенда через миксины — `SqApiAuth`,
/// `SqApiExperts`, `SqApiRequests`, `SqApiConsultations`, `SqApiPayments`,
/// `SqApiNotifications`, `SqApiTickets` (каждый в своём файле рядом) — чтобы
/// ни один файл не разрастался: у бэкенда почти три десятка релевантных
/// клиенту эндпоинтов, в одном файле это было бы неудобно читать и
/// ревьюить. Здесь — только сборка фасада, `Dio`, `TokenRefresher` и
/// подключение `AuthInterceptor`.
class SqApi extends SqApiBase
    with
        SqApiAuth,
        SqApiExperts,
        SqApiExpertProfile,
        SqApiDocuments,
        SqApiSchedule,
        SqApiOffers,
        SqApiRequests,
        SqApiConsultations,
        SqApiPayments,
        SqApiNotifications,
        SqApiTickets {
  SqApi({
    required String baseUrl,
    required TokenReader readTokens,
    required TokenWriter writeTokens,
    required Future<void> Function() onLogout,
  }) {
    dio = Dio(BaseOptions(baseUrl: baseUrl));
    // `refresh` — это `SqApiAuth.refresh` (тот же миксин, что и на этом
    // самом объекте) — TokenRefresher добавляет поверх него single-flight
    // и персист, не переизобретая сам запрос `POST /auth/refresh`.
    tokenRefresher = TokenRefresher(readTokens, writeTokens, refresh);
    AuthInterceptor(dio, readTokens, tokenRefresher, onLogout);
  }

  @override
  late final Dio dio;

  /// Единственный на этот клиент владелец обновления токенов сессии — им
  /// пользуется как `AuthInterceptor` (внутри, на HTTP 401), так и внешние
  /// потребители за пределами HTTP-стека (см. `app_client/core/providers
  /// .dart` — `connectSqEvents`, реагирует на разрыв WS, похожий на отказ
  /// аутентификации). Общий инстанс — не деталь конкретного потребителя:
  /// если бы каждый завёл свой `TokenRefresher`, single-flight
  /// координировал бы только внутри каждой копии по отдельности, что не
  /// решает саму задачу (см. отчёт задачи 8 эпика E6, раунд правок 2).
  late final TokenRefresher tokenRefresher;
}
