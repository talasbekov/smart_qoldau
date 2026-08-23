/// Аргументы экрана выбора слота: тема и формат выбираются до него, а
/// восстановить их из пути нельзя (E6b).
library;

import 'package:shared/shared.dart';

class BookingArgs {
  const BookingArgs({
    required this.expertId,
    required this.topicSlug,
    required this.format,
  });

  final String expertId;
  final String topicSlug;
  final SessionFormat format;
}
