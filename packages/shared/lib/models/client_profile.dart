/// Профиль клиента: имя и отметка согласия (Р-27).
///
/// До Р-27 продукт имени НЕ собирал вовсе — анонимность была не «имя
/// скрыто», а «имя не спрошено». Поэтому оба поля могут быть пустыми у
/// любого существующего пользователя.
class ClientProfile {
  const ClientProfile({
    required this.displayName,
    required this.expertVisibilityAcceptedAt,
  });

  /// Как человек попросил к нему обращаться. Свободная строка.
  final String? displayName;

  /// Когда человек согласился, что психолог видит имя и историю встреч.
  /// Хранится ВРЕМЯ, а не флаг: оно же граница, до которой консультации
  /// остаются под кодом клиента.
  final DateTime? expertVisibilityAcceptedAt;

  bool get needsExpertVisibilityConsent => expertVisibilityAcceptedAt == null;

  factory ClientProfile.fromJson(Map<String, dynamic> json) => ClientProfile(
    displayName: json['displayName'] as String?,
    expertVisibilityAcceptedAt: json['expertVisibilityAcceptedAt'] == null
        ? null
        : DateTime.parse(json['expertVisibilityAcceptedAt'] as String),
  );
}
