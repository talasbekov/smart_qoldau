// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'schedule_day.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$ScheduleDay {

 int get weekday; bool get enabled;@JsonKey(includeIfNull: false) int? get startMin;@JsonKey(includeIfNull: false) int? get endMin;@JsonKey(includeIfNull: false) int? get breakStart;@JsonKey(includeIfNull: false) int? get breakEnd;
/// Create a copy of ScheduleDay
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ScheduleDayCopyWith<ScheduleDay> get copyWith => _$ScheduleDayCopyWithImpl<ScheduleDay>(this as ScheduleDay, _$identity);

  /// Serializes this ScheduleDay to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ScheduleDay&&(identical(other.weekday, weekday) || other.weekday == weekday)&&(identical(other.enabled, enabled) || other.enabled == enabled)&&(identical(other.startMin, startMin) || other.startMin == startMin)&&(identical(other.endMin, endMin) || other.endMin == endMin)&&(identical(other.breakStart, breakStart) || other.breakStart == breakStart)&&(identical(other.breakEnd, breakEnd) || other.breakEnd == breakEnd));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,weekday,enabled,startMin,endMin,breakStart,breakEnd);

@override
String toString() {
  return 'ScheduleDay(weekday: $weekday, enabled: $enabled, startMin: $startMin, endMin: $endMin, breakStart: $breakStart, breakEnd: $breakEnd)';
}


}

/// @nodoc
abstract mixin class $ScheduleDayCopyWith<$Res>  {
  factory $ScheduleDayCopyWith(ScheduleDay value, $Res Function(ScheduleDay) _then) = _$ScheduleDayCopyWithImpl;
@useResult
$Res call({
 int weekday, bool enabled,@JsonKey(includeIfNull: false) int? startMin,@JsonKey(includeIfNull: false) int? endMin,@JsonKey(includeIfNull: false) int? breakStart,@JsonKey(includeIfNull: false) int? breakEnd
});




}
/// @nodoc
class _$ScheduleDayCopyWithImpl<$Res>
    implements $ScheduleDayCopyWith<$Res> {
  _$ScheduleDayCopyWithImpl(this._self, this._then);

  final ScheduleDay _self;
  final $Res Function(ScheduleDay) _then;

/// Create a copy of ScheduleDay
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? weekday = null,Object? enabled = null,Object? startMin = freezed,Object? endMin = freezed,Object? breakStart = freezed,Object? breakEnd = freezed,}) {
  return _then(ScheduleDay(
weekday: null == weekday ? _self.weekday : weekday // ignore: cast_nullable_to_non_nullable
as int,enabled: null == enabled ? _self.enabled : enabled // ignore: cast_nullable_to_non_nullable
as bool,startMin: freezed == startMin ? _self.startMin : startMin // ignore: cast_nullable_to_non_nullable
as int?,endMin: freezed == endMin ? _self.endMin : endMin // ignore: cast_nullable_to_non_nullable
as int?,breakStart: freezed == breakStart ? _self.breakStart : breakStart // ignore: cast_nullable_to_non_nullable
as int?,breakEnd: freezed == breakEnd ? _self.breakEnd : breakEnd // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}

}


/// Adds pattern-matching-related methods to [ScheduleDay].
extension ScheduleDayPatterns on ScheduleDay {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ScheduleDay value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ScheduleDay() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ScheduleDay value)  $default,){
final _that = this;
switch (_that) {
case _ScheduleDay():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ScheduleDay value)?  $default,){
final _that = this;
switch (_that) {
case _ScheduleDay() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int weekday,  bool enabled, @JsonKey(includeIfNull: false)  int? startMin, @JsonKey(includeIfNull: false)  int? endMin, @JsonKey(includeIfNull: false)  int? breakStart, @JsonKey(includeIfNull: false)  int? breakEnd)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ScheduleDay() when $default != null:
return $default(_that.weekday,_that.enabled,_that.startMin,_that.endMin,_that.breakStart,_that.breakEnd);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int weekday,  bool enabled, @JsonKey(includeIfNull: false)  int? startMin, @JsonKey(includeIfNull: false)  int? endMin, @JsonKey(includeIfNull: false)  int? breakStart, @JsonKey(includeIfNull: false)  int? breakEnd)  $default,) {final _that = this;
switch (_that) {
case _ScheduleDay():
return $default(_that.weekday,_that.enabled,_that.startMin,_that.endMin,_that.breakStart,_that.breakEnd);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int weekday,  bool enabled, @JsonKey(includeIfNull: false)  int? startMin, @JsonKey(includeIfNull: false)  int? endMin, @JsonKey(includeIfNull: false)  int? breakStart, @JsonKey(includeIfNull: false)  int? breakEnd)?  $default,) {final _that = this;
switch (_that) {
case _ScheduleDay() when $default != null:
return $default(_that.weekday,_that.enabled,_that.startMin,_that.endMin,_that.breakStart,_that.breakEnd);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ScheduleDay implements ScheduleDay {
  const _ScheduleDay({required this.weekday, required this.enabled, @JsonKey(includeIfNull: false) this.startMin, @JsonKey(includeIfNull: false) this.endMin, @JsonKey(includeIfNull: false) this.breakStart, @JsonKey(includeIfNull: false) this.breakEnd});
  factory _ScheduleDay.fromJson(Map<String, dynamic> json) => _$ScheduleDayFromJson(json);

@override final  int weekday;
@override final  bool enabled;
@override@JsonKey(includeIfNull: false) final  int? startMin;
@override@JsonKey(includeIfNull: false) final  int? endMin;
@override@JsonKey(includeIfNull: false) final  int? breakStart;
@override@JsonKey(includeIfNull: false) final  int? breakEnd;

/// Create a copy of ScheduleDay
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ScheduleDayCopyWith<_ScheduleDay> get copyWith => __$ScheduleDayCopyWithImpl<_ScheduleDay>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ScheduleDayToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ScheduleDay&&(identical(other.weekday, weekday) || other.weekday == weekday)&&(identical(other.enabled, enabled) || other.enabled == enabled)&&(identical(other.startMin, startMin) || other.startMin == startMin)&&(identical(other.endMin, endMin) || other.endMin == endMin)&&(identical(other.breakStart, breakStart) || other.breakStart == breakStart)&&(identical(other.breakEnd, breakEnd) || other.breakEnd == breakEnd));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,weekday,enabled,startMin,endMin,breakStart,breakEnd);

@override
String toString() {
  return 'ScheduleDay(weekday: $weekday, enabled: $enabled, startMin: $startMin, endMin: $endMin, breakStart: $breakStart, breakEnd: $breakEnd)';
}


}

/// @nodoc
abstract mixin class _$ScheduleDayCopyWith<$Res> implements $ScheduleDayCopyWith<$Res> {
  factory _$ScheduleDayCopyWith(_ScheduleDay value, $Res Function(_ScheduleDay) _then) = __$ScheduleDayCopyWithImpl;
@override @useResult
$Res call({
 int weekday, bool enabled,@JsonKey(includeIfNull: false) int? startMin,@JsonKey(includeIfNull: false) int? endMin,@JsonKey(includeIfNull: false) int? breakStart,@JsonKey(includeIfNull: false) int? breakEnd
});




}
/// @nodoc
class __$ScheduleDayCopyWithImpl<$Res>
    implements _$ScheduleDayCopyWith<$Res> {
  __$ScheduleDayCopyWithImpl(this._self, this._then);

  final _ScheduleDay _self;
  final $Res Function(_ScheduleDay) _then;

/// Create a copy of ScheduleDay
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? weekday = null,Object? enabled = null,Object? startMin = freezed,Object? endMin = freezed,Object? breakStart = freezed,Object? breakEnd = freezed,}) {
  return _then(_ScheduleDay(
weekday: null == weekday ? _self.weekday : weekday // ignore: cast_nullable_to_non_nullable
as int,enabled: null == enabled ? _self.enabled : enabled // ignore: cast_nullable_to_non_nullable
as bool,startMin: freezed == startMin ? _self.startMin : startMin // ignore: cast_nullable_to_non_nullable
as int?,endMin: freezed == endMin ? _self.endMin : endMin // ignore: cast_nullable_to_non_nullable
as int?,breakStart: freezed == breakStart ? _self.breakStart : breakStart // ignore: cast_nullable_to_non_nullable
as int?,breakEnd: freezed == breakEnd ? _self.breakEnd : breakEnd // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}


}

// dart format on
