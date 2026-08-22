import 'package:freezed_annotation/freezed_annotation.dart';

part 'online_count.freezed.dart';
part 'online_count.g.dart';

/// Число доступных под фильтр экспертов онлайн (`OnlineCountDto`,
/// `GET /matching/online-count`). Сам эндпоинт на бэкенде появляется в
/// задаче 9 эпика E6 — модель заведена уже сейчас, чтобы `SqApi.onlineCount`
/// (тоже этой задачи) и последующие задачи могли на неё опираться сразу.
@freezed
abstract class OnlineCount with _$OnlineCount {
  const factory OnlineCount({required int count}) = _OnlineCount;

  factory OnlineCount.fromJson(Map<String, dynamic> json) =>
      _$OnlineCountFromJson(json);
}
