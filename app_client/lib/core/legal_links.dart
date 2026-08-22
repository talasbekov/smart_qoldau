/// Правовые ссылки лендинга SmartQoldau (пользовательское соглашение,
/// политика конфиденциальности), выводимые с экрана приветствия
/// онбординга (см. `features/onboarding/ui/welcome_screen.dart`).
library;

/// Базовый адрес лендинга. Задаётся при сборке через
/// `--dart-define=LEGAL_BASE_URL`; значение по умолчанию — прод-домен.
///
/// Точная структура страниц лендинга ещё не зафиксирована (лендинг —
/// эпик E10), поэтому оба пути собраны в одном месте: когда структура
/// определится, правка потребуется только здесь.
const String legalBaseUrl = String.fromEnvironment(
  'LEGAL_BASE_URL',
  defaultValue: 'https://smartqoldau.kz',
);

/// Страница пользовательского соглашения.
const String termsUrl = '$legalBaseUrl/terms';

/// Страница политики конфиденциальности.
const String privacyUrl = '$legalBaseUrl/privacy';
