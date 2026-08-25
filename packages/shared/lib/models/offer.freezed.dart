// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'offer.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$OfferDto {

 String get offerId; String get topicSlug; SessionFormat get format; bool get isEmergency; int get clientCode; DateTime get deadlineAt;
/// Create a copy of OfferDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$OfferDtoCopyWith<OfferDto> get copyWith => _$OfferDtoCopyWithImpl<OfferDto>(this as OfferDto, _$identity);

  /// Serializes this OfferDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is OfferDto&&(identical(other.offerId, offerId) || other.offerId == offerId)&&(identical(other.topicSlug, topicSlug) || other.topicSlug == topicSlug)&&(identical(other.format, format) || other.format == format)&&(identical(other.isEmergency, isEmergency) || other.isEmergency == isEmergency)&&(identical(other.clientCode, clientCode) || other.clientCode == clientCode)&&(identical(other.deadlineAt, deadlineAt) || other.deadlineAt == deadlineAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,offerId,topicSlug,format,isEmergency,clientCode,deadlineAt);

@override
String toString() {
  return 'OfferDto(offerId: $offerId, topicSlug: $topicSlug, format: $format, isEmergency: $isEmergency, clientCode: $clientCode, deadlineAt: $deadlineAt)';
}


}

/// @nodoc
abstract mixin class $OfferDtoCopyWith<$Res>  {
  factory $OfferDtoCopyWith(OfferDto value, $Res Function(OfferDto) _then) = _$OfferDtoCopyWithImpl;
@useResult
$Res call({
 String offerId, String topicSlug, SessionFormat format, bool isEmergency, int clientCode, DateTime deadlineAt
});




}
/// @nodoc
class _$OfferDtoCopyWithImpl<$Res>
    implements $OfferDtoCopyWith<$Res> {
  _$OfferDtoCopyWithImpl(this._self, this._then);

  final OfferDto _self;
  final $Res Function(OfferDto) _then;

/// Create a copy of OfferDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? offerId = null,Object? topicSlug = null,Object? format = null,Object? isEmergency = null,Object? clientCode = null,Object? deadlineAt = null,}) {
  return _then(OfferDto(
offerId: null == offerId ? _self.offerId : offerId // ignore: cast_nullable_to_non_nullable
as String,topicSlug: null == topicSlug ? _self.topicSlug : topicSlug // ignore: cast_nullable_to_non_nullable
as String,format: null == format ? _self.format : format // ignore: cast_nullable_to_non_nullable
as SessionFormat,isEmergency: null == isEmergency ? _self.isEmergency : isEmergency // ignore: cast_nullable_to_non_nullable
as bool,clientCode: null == clientCode ? _self.clientCode : clientCode // ignore: cast_nullable_to_non_nullable
as int,deadlineAt: null == deadlineAt ? _self.deadlineAt : deadlineAt // ignore: cast_nullable_to_non_nullable
as DateTime,
  ));
}

}


/// Adds pattern-matching-related methods to [OfferDto].
extension OfferDtoPatterns on OfferDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _OfferDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _OfferDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _OfferDto value)  $default,){
final _that = this;
switch (_that) {
case _OfferDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _OfferDto value)?  $default,){
final _that = this;
switch (_that) {
case _OfferDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String offerId,  String topicSlug,  SessionFormat format,  bool isEmergency,  int clientCode,  DateTime deadlineAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _OfferDto() when $default != null:
return $default(_that.offerId,_that.topicSlug,_that.format,_that.isEmergency,_that.clientCode,_that.deadlineAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String offerId,  String topicSlug,  SessionFormat format,  bool isEmergency,  int clientCode,  DateTime deadlineAt)  $default,) {final _that = this;
switch (_that) {
case _OfferDto():
return $default(_that.offerId,_that.topicSlug,_that.format,_that.isEmergency,_that.clientCode,_that.deadlineAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String offerId,  String topicSlug,  SessionFormat format,  bool isEmergency,  int clientCode,  DateTime deadlineAt)?  $default,) {final _that = this;
switch (_that) {
case _OfferDto() when $default != null:
return $default(_that.offerId,_that.topicSlug,_that.format,_that.isEmergency,_that.clientCode,_that.deadlineAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _OfferDto implements OfferDto {
  const _OfferDto({required this.offerId, required this.topicSlug, required this.format, required this.isEmergency, required this.clientCode, required this.deadlineAt});
  factory _OfferDto.fromJson(Map<String, dynamic> json) => _$OfferDtoFromJson(json);

@override final  String offerId;
@override final  String topicSlug;
@override final  SessionFormat format;
@override final  bool isEmergency;
@override final  int clientCode;
@override final  DateTime deadlineAt;

/// Create a copy of OfferDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$OfferDtoCopyWith<_OfferDto> get copyWith => __$OfferDtoCopyWithImpl<_OfferDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$OfferDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _OfferDto&&(identical(other.offerId, offerId) || other.offerId == offerId)&&(identical(other.topicSlug, topicSlug) || other.topicSlug == topicSlug)&&(identical(other.format, format) || other.format == format)&&(identical(other.isEmergency, isEmergency) || other.isEmergency == isEmergency)&&(identical(other.clientCode, clientCode) || other.clientCode == clientCode)&&(identical(other.deadlineAt, deadlineAt) || other.deadlineAt == deadlineAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,offerId,topicSlug,format,isEmergency,clientCode,deadlineAt);

@override
String toString() {
  return 'OfferDto(offerId: $offerId, topicSlug: $topicSlug, format: $format, isEmergency: $isEmergency, clientCode: $clientCode, deadlineAt: $deadlineAt)';
}


}

/// @nodoc
abstract mixin class _$OfferDtoCopyWith<$Res> implements $OfferDtoCopyWith<$Res> {
  factory _$OfferDtoCopyWith(_OfferDto value, $Res Function(_OfferDto) _then) = __$OfferDtoCopyWithImpl;
@override @useResult
$Res call({
 String offerId, String topicSlug, SessionFormat format, bool isEmergency, int clientCode, DateTime deadlineAt
});




}
/// @nodoc
class __$OfferDtoCopyWithImpl<$Res>
    implements _$OfferDtoCopyWith<$Res> {
  __$OfferDtoCopyWithImpl(this._self, this._then);

  final _OfferDto _self;
  final $Res Function(_OfferDto) _then;

/// Create a copy of OfferDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? offerId = null,Object? topicSlug = null,Object? format = null,Object? isEmergency = null,Object? clientCode = null,Object? deadlineAt = null,}) {
  return _then(_OfferDto(
offerId: null == offerId ? _self.offerId : offerId // ignore: cast_nullable_to_non_nullable
as String,topicSlug: null == topicSlug ? _self.topicSlug : topicSlug // ignore: cast_nullable_to_non_nullable
as String,format: null == format ? _self.format : format // ignore: cast_nullable_to_non_nullable
as SessionFormat,isEmergency: null == isEmergency ? _self.isEmergency : isEmergency // ignore: cast_nullable_to_non_nullable
as bool,clientCode: null == clientCode ? _self.clientCode : clientCode // ignore: cast_nullable_to_non_nullable
as int,deadlineAt: null == deadlineAt ? _self.deadlineAt : deadlineAt // ignore: cast_nullable_to_non_nullable
as DateTime,
  ));
}


}


/// @nodoc
mixin _$AcceptOfferDto {

 String get requestId; RequestStatus get status; String get consultationId;
/// Create a copy of AcceptOfferDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$AcceptOfferDtoCopyWith<AcceptOfferDto> get copyWith => _$AcceptOfferDtoCopyWithImpl<AcceptOfferDto>(this as AcceptOfferDto, _$identity);

  /// Serializes this AcceptOfferDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is AcceptOfferDto&&(identical(other.requestId, requestId) || other.requestId == requestId)&&(identical(other.status, status) || other.status == status)&&(identical(other.consultationId, consultationId) || other.consultationId == consultationId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,requestId,status,consultationId);

@override
String toString() {
  return 'AcceptOfferDto(requestId: $requestId, status: $status, consultationId: $consultationId)';
}


}

/// @nodoc
abstract mixin class $AcceptOfferDtoCopyWith<$Res>  {
  factory $AcceptOfferDtoCopyWith(AcceptOfferDto value, $Res Function(AcceptOfferDto) _then) = _$AcceptOfferDtoCopyWithImpl;
@useResult
$Res call({
 String requestId, RequestStatus status, String consultationId
});




}
/// @nodoc
class _$AcceptOfferDtoCopyWithImpl<$Res>
    implements $AcceptOfferDtoCopyWith<$Res> {
  _$AcceptOfferDtoCopyWithImpl(this._self, this._then);

  final AcceptOfferDto _self;
  final $Res Function(AcceptOfferDto) _then;

/// Create a copy of AcceptOfferDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? requestId = null,Object? status = null,Object? consultationId = null,}) {
  return _then(AcceptOfferDto(
requestId: null == requestId ? _self.requestId : requestId // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as RequestStatus,consultationId: null == consultationId ? _self.consultationId : consultationId // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [AcceptOfferDto].
extension AcceptOfferDtoPatterns on AcceptOfferDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _AcceptOfferDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _AcceptOfferDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _AcceptOfferDto value)  $default,){
final _that = this;
switch (_that) {
case _AcceptOfferDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _AcceptOfferDto value)?  $default,){
final _that = this;
switch (_that) {
case _AcceptOfferDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String requestId,  RequestStatus status,  String consultationId)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _AcceptOfferDto() when $default != null:
return $default(_that.requestId,_that.status,_that.consultationId);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String requestId,  RequestStatus status,  String consultationId)  $default,) {final _that = this;
switch (_that) {
case _AcceptOfferDto():
return $default(_that.requestId,_that.status,_that.consultationId);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String requestId,  RequestStatus status,  String consultationId)?  $default,) {final _that = this;
switch (_that) {
case _AcceptOfferDto() when $default != null:
return $default(_that.requestId,_that.status,_that.consultationId);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _AcceptOfferDto implements AcceptOfferDto {
  const _AcceptOfferDto({required this.requestId, required this.status, required this.consultationId});
  factory _AcceptOfferDto.fromJson(Map<String, dynamic> json) => _$AcceptOfferDtoFromJson(json);

@override final  String requestId;
@override final  RequestStatus status;
@override final  String consultationId;

/// Create a copy of AcceptOfferDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$AcceptOfferDtoCopyWith<_AcceptOfferDto> get copyWith => __$AcceptOfferDtoCopyWithImpl<_AcceptOfferDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$AcceptOfferDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _AcceptOfferDto&&(identical(other.requestId, requestId) || other.requestId == requestId)&&(identical(other.status, status) || other.status == status)&&(identical(other.consultationId, consultationId) || other.consultationId == consultationId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,requestId,status,consultationId);

@override
String toString() {
  return 'AcceptOfferDto(requestId: $requestId, status: $status, consultationId: $consultationId)';
}


}

/// @nodoc
abstract mixin class _$AcceptOfferDtoCopyWith<$Res> implements $AcceptOfferDtoCopyWith<$Res> {
  factory _$AcceptOfferDtoCopyWith(_AcceptOfferDto value, $Res Function(_AcceptOfferDto) _then) = __$AcceptOfferDtoCopyWithImpl;
@override @useResult
$Res call({
 String requestId, RequestStatus status, String consultationId
});




}
/// @nodoc
class __$AcceptOfferDtoCopyWithImpl<$Res>
    implements _$AcceptOfferDtoCopyWith<$Res> {
  __$AcceptOfferDtoCopyWithImpl(this._self, this._then);

  final _AcceptOfferDto _self;
  final $Res Function(_AcceptOfferDto) _then;

/// Create a copy of AcceptOfferDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? requestId = null,Object? status = null,Object? consultationId = null,}) {
  return _then(_AcceptOfferDto(
requestId: null == requestId ? _self.requestId : requestId // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as RequestStatus,consultationId: null == consultationId ? _self.consultationId : consultationId // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on
