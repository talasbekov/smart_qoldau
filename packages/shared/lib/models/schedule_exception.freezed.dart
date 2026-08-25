// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'schedule_exception.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$ScheduleException {

 String get date; bool get isDayOff;@JsonKey(includeIfNull: false) int? get startMin;@JsonKey(includeIfNull: false) int? get endMin;
/// Create a copy of ScheduleException
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ScheduleExceptionCopyWith<ScheduleException> get copyWith => _$ScheduleExceptionCopyWithImpl<ScheduleException>(this as ScheduleException, _$identity);

  /// Serializes this ScheduleException to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ScheduleException&&(identical(other.date, date) || other.date == date)&&(identical(other.isDayOff, isDayOff) || other.isDayOff == isDayOff)&&(identical(other.startMin, startMin) || other.startMin == startMin)&&(identical(other.endMin, endMin) || other.endMin == endMin));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,date,isDayOff,startMin,endMin);

@override
String toString() {
  return 'ScheduleException(date: $date, isDayOff: $isDayOff, startMin: $startMin, endMin: $endMin)';
}


}

/// @nodoc
abstract mixin class $ScheduleExceptionCopyWith<$Res>  {
  factory $ScheduleExceptionCopyWith(ScheduleException value, $Res Function(ScheduleException) _then) = _$ScheduleExceptionCopyWithImpl;
@useResult
$Res call({
 String date, bool isDayOff,@JsonKey(includeIfNull: false) int? startMin,@JsonKey(includeIfNull: false) int? endMin
});




}
/// @nodoc
class _$ScheduleExceptionCopyWithImpl<$Res>
    implements $ScheduleExceptionCopyWith<$Res> {
  _$ScheduleExceptionCopyWithImpl(this._self, this._then);

  final ScheduleException _self;
  final $Res Function(ScheduleException) _then;

/// Create a copy of ScheduleException
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? date = null,Object? isDayOff = null,Object? startMin = freezed,Object? endMin = freezed,}) {
  return _then(ScheduleException(
date: null == date ? _self.date : date // ignore: cast_nullable_to_non_nullable
as String,isDayOff: null == isDayOff ? _self.isDayOff : isDayOff // ignore: cast_nullable_to_non_nullable
as bool,startMin: freezed == startMin ? _self.startMin : startMin // ignore: cast_nullable_to_non_nullable
as int?,endMin: freezed == endMin ? _self.endMin : endMin // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}

}


/// Adds pattern-matching-related methods to [ScheduleException].
extension ScheduleExceptionPatterns on ScheduleException {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ScheduleException value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ScheduleException() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ScheduleException value)  $default,){
final _that = this;
switch (_that) {
case _ScheduleException():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ScheduleException value)?  $default,){
final _that = this;
switch (_that) {
case _ScheduleException() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String date,  bool isDayOff, @JsonKey(includeIfNull: false)  int? startMin, @JsonKey(includeIfNull: false)  int? endMin)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ScheduleException() when $default != null:
return $default(_that.date,_that.isDayOff,_that.startMin,_that.endMin);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String date,  bool isDayOff, @JsonKey(includeIfNull: false)  int? startMin, @JsonKey(includeIfNull: false)  int? endMin)  $default,) {final _that = this;
switch (_that) {
case _ScheduleException():
return $default(_that.date,_that.isDayOff,_that.startMin,_that.endMin);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String date,  bool isDayOff, @JsonKey(includeIfNull: false)  int? startMin, @JsonKey(includeIfNull: false)  int? endMin)?  $default,) {final _that = this;
switch (_that) {
case _ScheduleException() when $default != null:
return $default(_that.date,_that.isDayOff,_that.startMin,_that.endMin);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ScheduleException implements ScheduleException {
  const _ScheduleException({required this.date, required this.isDayOff, @JsonKey(includeIfNull: false) this.startMin, @JsonKey(includeIfNull: false) this.endMin});
  factory _ScheduleException.fromJson(Map<String, dynamic> json) => _$ScheduleExceptionFromJson(json);

@override final  String date;
@override final  bool isDayOff;
@override@JsonKey(includeIfNull: false) final  int? startMin;
@override@JsonKey(includeIfNull: false) final  int? endMin;

/// Create a copy of ScheduleException
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ScheduleExceptionCopyWith<_ScheduleException> get copyWith => __$ScheduleExceptionCopyWithImpl<_ScheduleException>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ScheduleExceptionToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ScheduleException&&(identical(other.date, date) || other.date == date)&&(identical(other.isDayOff, isDayOff) || other.isDayOff == isDayOff)&&(identical(other.startMin, startMin) || other.startMin == startMin)&&(identical(other.endMin, endMin) || other.endMin == endMin));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,date,isDayOff,startMin,endMin);

@override
String toString() {
  return 'ScheduleException(date: $date, isDayOff: $isDayOff, startMin: $startMin, endMin: $endMin)';
}


}

/// @nodoc
abstract mixin class _$ScheduleExceptionCopyWith<$Res> implements $ScheduleExceptionCopyWith<$Res> {
  factory _$ScheduleExceptionCopyWith(_ScheduleException value, $Res Function(_ScheduleException) _then) = __$ScheduleExceptionCopyWithImpl;
@override @useResult
$Res call({
 String date, bool isDayOff,@JsonKey(includeIfNull: false) int? startMin,@JsonKey(includeIfNull: false) int? endMin
});




}
/// @nodoc
class __$ScheduleExceptionCopyWithImpl<$Res>
    implements _$ScheduleExceptionCopyWith<$Res> {
  __$ScheduleExceptionCopyWithImpl(this._self, this._then);

  final _ScheduleException _self;
  final $Res Function(_ScheduleException) _then;

/// Create a copy of ScheduleException
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? date = null,Object? isDayOff = null,Object? startMin = freezed,Object? endMin = freezed,}) {
  return _then(_ScheduleException(
date: null == date ? _self.date : date // ignore: cast_nullable_to_non_nullable
as String,isDayOff: null == isDayOff ? _self.isDayOff : isDayOff // ignore: cast_nullable_to_non_nullable
as bool,startMin: freezed == startMin ? _self.startMin : startMin // ignore: cast_nullable_to_non_nullable
as int?,endMin: freezed == endMin ? _self.endMin : endMin // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}


}

// dart format on
