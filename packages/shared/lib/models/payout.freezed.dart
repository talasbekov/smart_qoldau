// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'payout.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PayoutDto {

 String get id; int get amountTiyn; String get maskedPan; PayoutStatus get status; String? get rejectReason; DateTime get createdAt;
/// Create a copy of PayoutDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PayoutDtoCopyWith<PayoutDto> get copyWith => _$PayoutDtoCopyWithImpl<PayoutDto>(this as PayoutDto, _$identity);

  /// Serializes this PayoutDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PayoutDto&&(identical(other.id, id) || other.id == id)&&(identical(other.amountTiyn, amountTiyn) || other.amountTiyn == amountTiyn)&&(identical(other.maskedPan, maskedPan) || other.maskedPan == maskedPan)&&(identical(other.status, status) || other.status == status)&&(identical(other.rejectReason, rejectReason) || other.rejectReason == rejectReason)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,amountTiyn,maskedPan,status,rejectReason,createdAt);

@override
String toString() {
  return 'PayoutDto(id: $id, amountTiyn: $amountTiyn, maskedPan: $maskedPan, status: $status, rejectReason: $rejectReason, createdAt: $createdAt)';
}


}

/// @nodoc
abstract mixin class $PayoutDtoCopyWith<$Res>  {
  factory $PayoutDtoCopyWith(PayoutDto value, $Res Function(PayoutDto) _then) = _$PayoutDtoCopyWithImpl;
@useResult
$Res call({
 String id, int amountTiyn, String maskedPan, PayoutStatus status, String? rejectReason, DateTime createdAt
});




}
/// @nodoc
class _$PayoutDtoCopyWithImpl<$Res>
    implements $PayoutDtoCopyWith<$Res> {
  _$PayoutDtoCopyWithImpl(this._self, this._then);

  final PayoutDto _self;
  final $Res Function(PayoutDto) _then;

/// Create a copy of PayoutDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? amountTiyn = null,Object? maskedPan = null,Object? status = null,Object? rejectReason = freezed,Object? createdAt = null,}) {
  return _then(PayoutDto(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,amountTiyn: null == amountTiyn ? _self.amountTiyn : amountTiyn // ignore: cast_nullable_to_non_nullable
as int,maskedPan: null == maskedPan ? _self.maskedPan : maskedPan // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as PayoutStatus,rejectReason: freezed == rejectReason ? _self.rejectReason : rejectReason // ignore: cast_nullable_to_non_nullable
as String?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,
  ));
}

}


/// Adds pattern-matching-related methods to [PayoutDto].
extension PayoutDtoPatterns on PayoutDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PayoutDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PayoutDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PayoutDto value)  $default,){
final _that = this;
switch (_that) {
case _PayoutDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PayoutDto value)?  $default,){
final _that = this;
switch (_that) {
case _PayoutDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  int amountTiyn,  String maskedPan,  PayoutStatus status,  String? rejectReason,  DateTime createdAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PayoutDto() when $default != null:
return $default(_that.id,_that.amountTiyn,_that.maskedPan,_that.status,_that.rejectReason,_that.createdAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  int amountTiyn,  String maskedPan,  PayoutStatus status,  String? rejectReason,  DateTime createdAt)  $default,) {final _that = this;
switch (_that) {
case _PayoutDto():
return $default(_that.id,_that.amountTiyn,_that.maskedPan,_that.status,_that.rejectReason,_that.createdAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  int amountTiyn,  String maskedPan,  PayoutStatus status,  String? rejectReason,  DateTime createdAt)?  $default,) {final _that = this;
switch (_that) {
case _PayoutDto() when $default != null:
return $default(_that.id,_that.amountTiyn,_that.maskedPan,_that.status,_that.rejectReason,_that.createdAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PayoutDto implements PayoutDto {
  const _PayoutDto({required this.id, required this.amountTiyn, required this.maskedPan, required this.status, this.rejectReason, required this.createdAt});
  factory _PayoutDto.fromJson(Map<String, dynamic> json) => _$PayoutDtoFromJson(json);

@override final  String id;
@override final  int amountTiyn;
@override final  String maskedPan;
@override final  PayoutStatus status;
@override final  String? rejectReason;
@override final  DateTime createdAt;

/// Create a copy of PayoutDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PayoutDtoCopyWith<_PayoutDto> get copyWith => __$PayoutDtoCopyWithImpl<_PayoutDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PayoutDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PayoutDto&&(identical(other.id, id) || other.id == id)&&(identical(other.amountTiyn, amountTiyn) || other.amountTiyn == amountTiyn)&&(identical(other.maskedPan, maskedPan) || other.maskedPan == maskedPan)&&(identical(other.status, status) || other.status == status)&&(identical(other.rejectReason, rejectReason) || other.rejectReason == rejectReason)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,amountTiyn,maskedPan,status,rejectReason,createdAt);

@override
String toString() {
  return 'PayoutDto(id: $id, amountTiyn: $amountTiyn, maskedPan: $maskedPan, status: $status, rejectReason: $rejectReason, createdAt: $createdAt)';
}


}

/// @nodoc
abstract mixin class _$PayoutDtoCopyWith<$Res> implements $PayoutDtoCopyWith<$Res> {
  factory _$PayoutDtoCopyWith(_PayoutDto value, $Res Function(_PayoutDto) _then) = __$PayoutDtoCopyWithImpl;
@override @useResult
$Res call({
 String id, int amountTiyn, String maskedPan, PayoutStatus status, String? rejectReason, DateTime createdAt
});




}
/// @nodoc
class __$PayoutDtoCopyWithImpl<$Res>
    implements _$PayoutDtoCopyWith<$Res> {
  __$PayoutDtoCopyWithImpl(this._self, this._then);

  final _PayoutDto _self;
  final $Res Function(_PayoutDto) _then;

/// Create a copy of PayoutDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? amountTiyn = null,Object? maskedPan = null,Object? status = null,Object? rejectReason = freezed,Object? createdAt = null,}) {
  return _then(_PayoutDto(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,amountTiyn: null == amountTiyn ? _self.amountTiyn : amountTiyn // ignore: cast_nullable_to_non_nullable
as int,maskedPan: null == maskedPan ? _self.maskedPan : maskedPan // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as PayoutStatus,rejectReason: freezed == rejectReason ? _self.rejectReason : rejectReason // ignore: cast_nullable_to_non_nullable
as String?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,
  ));
}


}

// dart format on
