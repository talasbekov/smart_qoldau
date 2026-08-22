import 'package:dio/dio.dart';

import 'auth_interceptor.dart';
import 'sq_api_auth.dart';
import 'sq_api_base.dart';
import 'sq_api_consultations.dart';
import 'sq_api_experts.dart';
import 'sq_api_notifications.dart';
import 'sq_api_payments.dart';
import 'sq_api_requests.dart';
import 'sq_api_tickets.dart';

/// Типизированный клиент к бэкенду SmartQoldau.
///
/// Методы сгруппированы по модулям бэкенда через миксины — `SqApiAuth`,
/// `SqApiExperts`, `SqApiRequests`, `SqApiConsultations`, `SqApiPayments`,
/// `SqApiNotifications`, `SqApiTickets` (каждый в своём файле рядом) — чтобы
/// ни один файл не разрастался: у бэкенда почти три десятка релевантных
/// клиенту эндпоинтов, в одном файле это было бы неудобно читать и
/// ревьюить. Здесь — только сборка фасада, `Dio` и подключение
/// `AuthInterceptor`.
class SqApi extends SqApiBase
    with
        SqApiAuth,
        SqApiExperts,
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
  }) : dio = Dio(BaseOptions(baseUrl: baseUrl)) {
    AuthInterceptor(readTokens, writeTokens, onLogout).attach(dio);
  }

  @override
  final Dio dio;
}
