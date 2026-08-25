// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'consultation_expert.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$ConsultationExpertDto {

 String get id; ConsultationStatus get status; ConsultationOutcome? get outcome; SessionFormat get format; bool get isEmergency; DateTime get startedAt; DateTime? get endedAt; int get clientCode; String get topicSlug; int get priceTiyn; int get plannedDurationMin; ConsultationPaymentStatus get paymentStatus;
/// Create a copy of ConsultationExpertDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ConsultationExpertDtoCopyWith<ConsultationExpertDto> get copyWith => _$ConsultationExpertDtoCopyWithImpl<ConsultationExpertDto>(this as ConsultationExpertDto, _$identity);

  /// Serializes this ConsultationExpertDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ConsultationExpertDto&&(identical(other.id, id) || other.id == id)&&(identical(other.status, status) || other.status == status)&&(identical(other.outcome, outcome) || other.outcome == outcome)&&(identical(other.format, format) || other.format == format)&&(identical(other.isEmergency, isEmergency) || other.isEmergency == isEmergency)&&(identical(other.startedAt, startedAt) || other.startedAt == startedAt)&&(identical(other.endedAt, endedAt) || other.endedAt == endedAt)&&(identical(other.clientCode, clientCode) || other.clientCode == clientCode)&&(identical(other.topicSlug, topicSlug) || other.topicSlug == topicSlug)&&(identical(other.priceTiyn, priceTiyn) || other.priceTiyn == priceTiyn)&&(identical(other.plannedDurationMin, plannedDurationMin) || other.plannedDurationMin == plannedDurationMin)&&(identical(other.paymentStatus, paymentStatus) || other.paymentStatus == paymentStatus));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,status,outcome,format,isEmergency,startedAt,endedAt,clientCode,topicSlug,priceTiyn,plannedDurationMin,paymentStatus);

@override
String toString() {
  return 'ConsultationExpertDto(id: $id, status: $status, outcome: $outcome, format: $format, isEmergency: $isEmergency, startedAt: $startedAt, endedAt: $endedAt, clientCode: $clientCode, topicSlug: $topicSlug, priceTiyn: $priceTiyn, plannedDurationMin: $plannedDurationMin, paymentStatus: $paymentStatus)';
}


}

/// @nodoc
abstract mixin class $ConsultationExpertDtoCopyWith<$Res>  {
  factory $ConsultationExpertDtoCopyWith(ConsultationExpertDto value, $Res Function(ConsultationExpertDto) _then) = _$ConsultationExpertDtoCopyWithImpl;
@useResult
$Res call({
 String id, ConsultationStatus status, ConsultationOutcome? outcome, SessionFormat format, bool isEmergency, DateTime startedAt, DateTime? endedAt, int clientCode, String topicSlug, int priceTiyn, int plannedDurationMin, ConsultationPaymentStatus paymentStatus
});




}
/// @nodoc
class _$ConsultationExpertDtoCopyWithImpl<$Res>
    implements $ConsultationExpertDtoCopyWith<$Res> {
  _$ConsultationExpertDtoCopyWithImpl(this._self, this._then);

  final ConsultationExpertDto _self;
  final $Res Function(ConsultationExpertDto) _then;

/// Create a copy of ConsultationExpertDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? status = null,Object? outcome = freezed,Object? format = null,Object? isEmergency = null,Object? startedAt = null,Object? endedAt = freezed,Object? clientCode = null,Object? topicSlug = null,Object? priceTiyn = null,Object? plannedDurationMin = null,Object? paymentStatus = null,}) {
  return _then(ConsultationExpertDto(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as ConsultationStatus,outcome: freezed == outcome ? _self.outcome : outcome // ignore: cast_nullable_to_non_nullable
as ConsultationOutcome?,format: null == format ? _self.format : format // ignore: cast_nullable_to_non_nullable
as SessionFormat,isEmergency: null == isEmergency ? _self.isEmergency : isEmergency // ignore: cast_nullable_to_non_nullable
as bool,startedAt: null == startedAt ? _self.startedAt : startedAt // ignore: cast_nullable_to_non_nullable
as DateTime,endedAt: freezed == endedAt ? _self.endedAt : endedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,clientCode: null == clientCode ? _self.clientCode : clientCode // ignore: cast_nullable_to_non_nullable
as int,topicSlug: null == topicSlug ? _self.topicSlug : topicSlug // ignore: cast_nullable_to_non_nullable
as String,priceTiyn: null == priceTiyn ? _self.priceTiyn : priceTiyn // ignore: cast_nullable_to_non_nullable
as int,plannedDurationMin: null == plannedDurationMin ? _self.plannedDurationMin : plannedDurationMin // ignore: cast_nullable_to_non_nullable
as int,paymentStatus: null == paymentStatus ? _self.paymentStatus : paymentStatus // ignore: cast_nullable_to_non_nullable
as ConsultationPaymentStatus,
  ));
}

}


/// Adds pattern-matching-related methods to [ConsultationExpertDto].
extension ConsultationExpertDtoPatterns on ConsultationExpertDto {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ConsultationExpertDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ConsultationExpertDto() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ConsultationExpertDto value)  $default,){
final _that = this;
switch (_that) {
case _ConsultationExpertDto():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ConsultationExpertDto value)?  $default,){
final _that = this;
switch (_that) {
case _ConsultationExpertDto() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  ConsultationStatus status,  ConsultationOutcome? outcome,  SessionFormat format,  bool isEmergency,  DateTime startedAt,  DateTime? endedAt,  int clientCode,  String topicSlug,  int priceTiyn,  int plannedDurationMin,  ConsultationPaymentStatus paymentStatus)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ConsultationExpertDto() when $default != null:
return $default(_that.id,_that.status,_that.outcome,_that.format,_that.isEmergency,_that.startedAt,_that.endedAt,_that.clientCode,_that.topicSlug,_that.priceTiyn,_that.plannedDurationMin,_that.paymentStatus);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  ConsultationStatus status,  ConsultationOutcome? outcome,  SessionFormat format,  bool isEmergency,  DateTime startedAt,  DateTime? endedAt,  int clientCode,  String topicSlug,  int priceTiyn,  int plannedDurationMin,  ConsultationPaymentStatus paymentStatus)  $default,) {final _that = this;
switch (_that) {
case _ConsultationExpertDto():
return $default(_that.id,_that.status,_that.outcome,_that.format,_that.isEmergency,_that.startedAt,_that.endedAt,_that.clientCode,_that.topicSlug,_that.priceTiyn,_that.plannedDurationMin,_that.paymentStatus);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  ConsultationStatus status,  ConsultationOutcome? outcome,  SessionFormat format,  bool isEmergency,  DateTime startedAt,  DateTime? endedAt,  int clientCode,  String topicSlug,  int priceTiyn,  int plannedDurationMin,  ConsultationPaymentStatus paymentStatus)?  $default,) {final _that = this;
switch (_that) {
case _ConsultationExpertDto() when $default != null:
return $default(_that.id,_that.status,_that.outcome,_that.format,_that.isEmergency,_that.startedAt,_that.endedAt,_that.clientCode,_that.topicSlug,_that.priceTiyn,_that.plannedDurationMin,_that.paymentStatus);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ConsultationExpertDto implements ConsultationExpertDto {
  const _ConsultationExpertDto({required this.id, required this.status, this.outcome, required this.format, required this.isEmergency, required this.startedAt, this.endedAt, required this.clientCode, required this.topicSlug, required this.priceTiyn, required this.plannedDurationMin, required this.paymentStatus});
  factory _ConsultationExpertDto.fromJson(Map<String, dynamic> json) => _$ConsultationExpertDtoFromJson(json);

@override final  String id;
@override final  ConsultationStatus status;
@override final  ConsultationOutcome? outcome;
@override final  SessionFormat format;
@override final  bool isEmergency;
@override final  DateTime startedAt;
@override final  DateTime? endedAt;
@override final  int clientCode;
@override final  String topicSlug;
@override final  int priceTiyn;
@override final  int plannedDurationMin;
@override final  ConsultationPaymentStatus paymentStatus;

/// Create a copy of ConsultationExpertDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ConsultationExpertDtoCopyWith<_ConsultationExpertDto> get copyWith => __$ConsultationExpertDtoCopyWithImpl<_ConsultationExpertDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ConsultationExpertDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ConsultationExpertDto&&(identical(other.id, id) || other.id == id)&&(identical(other.status, status) || other.status == status)&&(identical(other.outcome, outcome) || other.outcome == outcome)&&(identical(other.format, format) || other.format == format)&&(identical(other.isEmergency, isEmergency) || other.isEmergency == isEmergency)&&(identical(other.startedAt, startedAt) || other.startedAt == startedAt)&&(identical(other.endedAt, endedAt) || other.endedAt == endedAt)&&(identical(other.clientCode, clientCode) || other.clientCode == clientCode)&&(identical(other.topicSlug, topicSlug) || other.topicSlug == topicSlug)&&(identical(other.priceTiyn, priceTiyn) || other.priceTiyn == priceTiyn)&&(identical(other.plannedDurationMin, plannedDurationMin) || other.plannedDurationMin == plannedDurationMin)&&(identical(other.paymentStatus, paymentStatus) || other.paymentStatus == paymentStatus));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,status,outcome,format,isEmergency,startedAt,endedAt,clientCode,topicSlug,priceTiyn,plannedDurationMin,paymentStatus);

@override
String toString() {
  return 'ConsultationExpertDto(id: $id, status: $status, outcome: $outcome, format: $format, isEmergency: $isEmergency, startedAt: $startedAt, endedAt: $endedAt, clientCode: $clientCode, topicSlug: $topicSlug, priceTiyn: $priceTiyn, plannedDurationMin: $plannedDurationMin, paymentStatus: $paymentStatus)';
}


}

/// @nodoc
abstract mixin class _$ConsultationExpertDtoCopyWith<$Res> implements $ConsultationExpertDtoCopyWith<$Res> {
  factory _$ConsultationExpertDtoCopyWith(_ConsultationExpertDto value, $Res Function(_ConsultationExpertDto) _then) = __$ConsultationExpertDtoCopyWithImpl;
@override @useResult
$Res call({
 String id, ConsultationStatus status, ConsultationOutcome? outcome, SessionFormat format, bool isEmergency, DateTime startedAt, DateTime? endedAt, int clientCode, String topicSlug, int priceTiyn, int plannedDurationMin, ConsultationPaymentStatus paymentStatus
});




}
/// @nodoc
class __$ConsultationExpertDtoCopyWithImpl<$Res>
    implements _$ConsultationExpertDtoCopyWith<$Res> {
  __$ConsultationExpertDtoCopyWithImpl(this._self, this._then);

  final _ConsultationExpertDto _self;
  final $Res Function(_ConsultationExpertDto) _then;

/// Create a copy of ConsultationExpertDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? status = null,Object? outcome = freezed,Object? format = null,Object? isEmergency = null,Object? startedAt = null,Object? endedAt = freezed,Object? clientCode = null,Object? topicSlug = null,Object? priceTiyn = null,Object? plannedDurationMin = null,Object? paymentStatus = null,}) {
  return _then(_ConsultationExpertDto(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as ConsultationStatus,outcome: freezed == outcome ? _self.outcome : outcome // ignore: cast_nullable_to_non_nullable
as ConsultationOutcome?,format: null == format ? _self.format : format // ignore: cast_nullable_to_non_nullable
as SessionFormat,isEmergency: null == isEmergency ? _self.isEmergency : isEmergency // ignore: cast_nullable_to_non_nullable
as bool,startedAt: null == startedAt ? _self.startedAt : startedAt // ignore: cast_nullable_to_non_nullable
as DateTime,endedAt: freezed == endedAt ? _self.endedAt : endedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,clientCode: null == clientCode ? _self.clientCode : clientCode // ignore: cast_nullable_to_non_nullable
as int,topicSlug: null == topicSlug ? _self.topicSlug : topicSlug // ignore: cast_nullable_to_non_nullable
as String,priceTiyn: null == priceTiyn ? _self.priceTiyn : priceTiyn // ignore: cast_nullable_to_non_nullable
as int,plannedDurationMin: null == plannedDurationMin ? _self.plannedDurationMin : plannedDurationMin // ignore: cast_nullable_to_non_nullable
as int,paymentStatus: null == paymentStatus ? _self.paymentStatus : paymentStatus // ignore: cast_nullable_to_non_nullable
as ConsultationPaymentStatus,
  ));
}


}

// dart format on
