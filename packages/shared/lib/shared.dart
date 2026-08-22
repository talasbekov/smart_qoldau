/// Единственная публичная точка входа пакета `shared`.
///
/// Пакет копит общий для клиентских приложений SmartQoldau код: API-клиент,
/// модели данных и дизайн-систему (наполняются последующими задачами эпика
/// E6). [sharedPackageMarker] подтверждает, что публичный API пакета
/// загружается и доступен потребителям.
library;

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
export 'format/locale.dart';
export 'format/money.dart';

const String sharedPackageMarker = 'smartqoldau-shared';
