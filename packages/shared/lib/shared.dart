/// Единственная публичная точка входа пакета `shared`.
///
/// Пакет копит общий для клиентских приложений SmartQoldau код: API-клиент,
/// модели данных и дизайн-систему (наполняются последующими задачами эпика
/// E6). [sharedPackageMarker] подтверждает, что публичный API пакета
/// загружается и доступен потребителям.
library;

export 'analytics/analytics_event.dart';
export 'analytics/analytics_port.dart';
export 'analytics/analytics_provider.dart';
export 'analytics/noop_analytics.dart';
export 'analytics/posthog_analytics.dart';
export 'design/breakpoints.dart';
export 'design/readable_width.dart';
export 'design/session_layout.dart';
export 'design/sheet_or_dialog.dart';
export 'design/split_layout.dart';
export 'api/api_exception.dart';
export 'api/auth_interceptor.dart';
export 'api/backend_base_url.dart';
export 'api/sq_api.dart';
export 'api/sq_api_base.dart' show TokenReader, TokenWriter;
export 'api/sq_api_documents.dart'
    show DocumentTooLargeException, documentMaxSizeBytes;
export 'api/sq_api_provider.dart';
export 'api/sq_endpoints.dart';
export 'api/token_refresher.dart';
export 'design/tokens.dart';
export 'design/theme.dart';
export 'design/widgets/avatar.dart';
export 'design/widgets/button.dart';
export 'design/widgets/card.dart';
export 'design/widgets/chip.dart';
export 'design/widgets/emergency_disclaimer.dart';
export 'design/widgets/empty_state.dart';
export 'design/widgets/error_view.dart';
export 'design/widgets/loader.dart';
export 'design/widgets/rating_stars.dart';
export 'design/widgets/text_field.dart';
export 'events/sq_events.dart';
export 'events/sq_events_provider.dart';
export 'format/locale.dart';
export 'format/money.dart';
export 'models/models.dart';
export 'permissions/permission_service.dart';
export 'push/firebase_push_messaging_port.dart';
export 'push/push_bootstrap.dart';
export 'push/push_config.dart';
export 'push/push_messaging_port.dart';
export 'session/call/call_controller.dart';
export 'session/call/call_engine.dart';
export 'session/call/livekit_call_engine.dart';
export 'session/call/media_repository.dart';
export 'session/chat/chat_controller.dart';
export 'session/chat/chat_repository.dart';

const String sharedPackageMarker = 'smartqoldau-shared';
