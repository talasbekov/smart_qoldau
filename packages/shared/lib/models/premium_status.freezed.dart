// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'premium_status.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PremiumStatus {

/// Доступ к Premium прямо сейчас. Остаётся true после отмены — до конца
/// оплаченного периода — и во время ретраев автопродления (Р-09).
 bool get active; bool get cancelled;/// Оплата не прошла, идут попытки списания; доступ пока сохраняется.
 bool get inGrace; PremiumPlan? get plan; DateTime? get currentPeriodEnd;
/// Create a copy of PremiumStatus
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PremiumStatusCopyWith<PremiumStatus> get copyWith => _$PremiumStatusCopyWithImpl<PremiumStatus>(this as PremiumStatus, _$identity);

  /// Serializes this PremiumStatus to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PremiumStatus&&(identical(other.active, active) || other.active == active)&&(identical(other.cancelled, cancelled) || other.cancelled == cancelled)&&(identical(other.inGrace, inGrace) || other.inGrace == inGrace)&&(identical(other.plan, plan) || other.plan == plan)&&(identical(other.currentPeriodEnd, currentPeriodEnd) || other.currentPeriodEnd == currentPeriodEnd));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,active,cancelled,inGrace,plan,currentPeriodEnd);

@override
String toString() {
  return 'PremiumStatus(active: $active, cancelled: $cancelled, inGrace: $inGrace, plan: $plan, currentPeriodEnd: $currentPeriodEnd)';
}


}

/// @nodoc
abstract mixin class $PremiumStatusCopyWith<$Res>  {
  factory $PremiumStatusCopyWith(PremiumStatus value, $Res Function(PremiumStatus) _then) = _$PremiumStatusCopyWithImpl;
@useResult
$Res call({
 bool active, bool cancelled, bool inGrace, PremiumPlan? plan, DateTime? currentPeriodEnd
});




}
/// @nodoc
class _$PremiumStatusCopyWithImpl<$Res>
    implements $PremiumStatusCopyWith<$Res> {
  _$PremiumStatusCopyWithImpl(this._self, this._then);

  final PremiumStatus _self;
  final $Res Function(PremiumStatus) _then;

/// Create a copy of PremiumStatus
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? active = null,Object? cancelled = null,Object? inGrace = null,Object? plan = freezed,Object? currentPeriodEnd = freezed,}) {
  return _then(PremiumStatus(
active: null == active ? _self.active : active // ignore: cast_nullable_to_non_nullable
as bool,cancelled: null == cancelled ? _self.cancelled : cancelled // ignore: cast_nullable_to_non_nullable
as bool,inGrace: null == inGrace ? _self.inGrace : inGrace // ignore: cast_nullable_to_non_nullable
as bool,plan: freezed == plan ? _self.plan : plan // ignore: cast_nullable_to_non_nullable
as PremiumPlan?,currentPeriodEnd: freezed == currentPeriodEnd ? _self.currentPeriodEnd : currentPeriodEnd // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}

}


/// Adds pattern-matching-related methods to [PremiumStatus].
extension PremiumStatusPatterns on PremiumStatus {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PremiumStatus value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PremiumStatus() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PremiumStatus value)  $default,){
final _that = this;
switch (_that) {
case _PremiumStatus():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PremiumStatus value)?  $default,){
final _that = this;
switch (_that) {
case _PremiumStatus() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( bool active,  bool cancelled,  bool inGrace,  PremiumPlan? plan,  DateTime? currentPeriodEnd)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PremiumStatus() when $default != null:
return $default(_that.active,_that.cancelled,_that.inGrace,_that.plan,_that.currentPeriodEnd);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( bool active,  bool cancelled,  bool inGrace,  PremiumPlan? plan,  DateTime? currentPeriodEnd)  $default,) {final _that = this;
switch (_that) {
case _PremiumStatus():
return $default(_that.active,_that.cancelled,_that.inGrace,_that.plan,_that.currentPeriodEnd);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( bool active,  bool cancelled,  bool inGrace,  PremiumPlan? plan,  DateTime? currentPeriodEnd)?  $default,) {final _that = this;
switch (_that) {
case _PremiumStatus() when $default != null:
return $default(_that.active,_that.cancelled,_that.inGrace,_that.plan,_that.currentPeriodEnd);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PremiumStatus implements PremiumStatus {
  const _PremiumStatus({required this.active, required this.cancelled, required this.inGrace, this.plan, this.currentPeriodEnd});
  factory _PremiumStatus.fromJson(Map<String, dynamic> json) => _$PremiumStatusFromJson(json);

/// Доступ к Premium прямо сейчас. Остаётся true после отмены — до конца
/// оплаченного периода — и во время ретраев автопродления (Р-09).
@override final  bool active;
@override final  bool cancelled;
/// Оплата не прошла, идут попытки списания; доступ пока сохраняется.
@override final  bool inGrace;
@override final  PremiumPlan? plan;
@override final  DateTime? currentPeriodEnd;

/// Create a copy of PremiumStatus
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PremiumStatusCopyWith<_PremiumStatus> get copyWith => __$PremiumStatusCopyWithImpl<_PremiumStatus>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PremiumStatusToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PremiumStatus&&(identical(other.active, active) || other.active == active)&&(identical(other.cancelled, cancelled) || other.cancelled == cancelled)&&(identical(other.inGrace, inGrace) || other.inGrace == inGrace)&&(identical(other.plan, plan) || other.plan == plan)&&(identical(other.currentPeriodEnd, currentPeriodEnd) || other.currentPeriodEnd == currentPeriodEnd));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,active,cancelled,inGrace,plan,currentPeriodEnd);

@override
String toString() {
  return 'PremiumStatus(active: $active, cancelled: $cancelled, inGrace: $inGrace, plan: $plan, currentPeriodEnd: $currentPeriodEnd)';
}


}

/// @nodoc
abstract mixin class _$PremiumStatusCopyWith<$Res> implements $PremiumStatusCopyWith<$Res> {
  factory _$PremiumStatusCopyWith(_PremiumStatus value, $Res Function(_PremiumStatus) _then) = __$PremiumStatusCopyWithImpl;
@override @useResult
$Res call({
 bool active, bool cancelled, bool inGrace, PremiumPlan? plan, DateTime? currentPeriodEnd
});




}
/// @nodoc
class __$PremiumStatusCopyWithImpl<$Res>
    implements _$PremiumStatusCopyWith<$Res> {
  __$PremiumStatusCopyWithImpl(this._self, this._then);

  final _PremiumStatus _self;
  final $Res Function(_PremiumStatus) _then;

/// Create a copy of PremiumStatus
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? active = null,Object? cancelled = null,Object? inGrace = null,Object? plan = freezed,Object? currentPeriodEnd = freezed,}) {
  return _then(_PremiumStatus(
active: null == active ? _self.active : active // ignore: cast_nullable_to_non_nullable
as bool,cancelled: null == cancelled ? _self.cancelled : cancelled // ignore: cast_nullable_to_non_nullable
as bool,inGrace: null == inGrace ? _self.inGrace : inGrace // ignore: cast_nullable_to_non_nullable
as bool,plan: freezed == plan ? _self.plan : plan // ignore: cast_nullable_to_non_nullable
as PremiumPlan?,currentPeriodEnd: freezed == currentPeriodEnd ? _self.currentPeriodEnd : currentPeriodEnd // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}


}

// dart format on
