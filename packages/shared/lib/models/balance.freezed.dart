// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'balance.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$BalanceDto {

 int get balanceTiyn; int get availableTiyn;
/// Create a copy of BalanceDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$BalanceDtoCopyWith<BalanceDto> get copyWith => _$BalanceDtoCopyWithImpl<BalanceDto>(this as BalanceDto, _$identity);

  /// Serializes this BalanceDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is BalanceDto&&(identical(other.balanceTiyn, balanceTiyn) || other.balanceTiyn == balanceTiyn)&&(identical(other.availableTiyn, availableTiyn) || other.availableTiyn == availableTiyn));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,balanceTiyn,availableTiyn);

@override
String toString() {
  return 'BalanceDto(balanceTiyn: $balanceTiyn, availableTiyn: $availableTiyn)';
}


}

/// @nodoc
abstract mixin class $BalanceDtoCopyWith<$Res>  {
  factory $BalanceDtoCopyWith(BalanceDto value, $Res Function(BalanceDto) _then) = _$BalanceDtoCopyWithImpl;
@useResult
$Res call({
 int balanceTiyn, int availableTiyn
});




}
/// @nodoc
class _$BalanceDtoCopyWithImpl<$Res>
    implements $BalanceDtoCopyWith<$Res> {
  _$BalanceDtoCopyWithImpl(this._self, this._then);

  final BalanceDto _self;
  final $Res Function(BalanceDto) _then;

/// Create a copy of BalanceDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? balanceTiyn = null,Object? availableTiyn = null,}) {
  return _then(BalanceDto(
balanceTiyn: null == balanceTiyn ? _self.balanceTiyn : balanceTiyn // ignore: cast_nullable_to_non_nullable
as int,availableTiyn: null == availableTiyn ? _self.availableTiyn : availableTiyn // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [BalanceDto].
extension BalanceDtoPatterns on BalanceDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _BalanceDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _BalanceDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _BalanceDto value)  $default,){
final _that = this;
switch (_that) {
case _BalanceDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _BalanceDto value)?  $default,){
final _that = this;
switch (_that) {
case _BalanceDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int balanceTiyn,  int availableTiyn)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _BalanceDto() when $default != null:
return $default(_that.balanceTiyn,_that.availableTiyn);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int balanceTiyn,  int availableTiyn)  $default,) {final _that = this;
switch (_that) {
case _BalanceDto():
return $default(_that.balanceTiyn,_that.availableTiyn);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int balanceTiyn,  int availableTiyn)?  $default,) {final _that = this;
switch (_that) {
case _BalanceDto() when $default != null:
return $default(_that.balanceTiyn,_that.availableTiyn);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _BalanceDto implements BalanceDto {
  const _BalanceDto({required this.balanceTiyn, required this.availableTiyn});
  factory _BalanceDto.fromJson(Map<String, dynamic> json) => _$BalanceDtoFromJson(json);

@override final  int balanceTiyn;
@override final  int availableTiyn;

/// Create a copy of BalanceDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$BalanceDtoCopyWith<_BalanceDto> get copyWith => __$BalanceDtoCopyWithImpl<_BalanceDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$BalanceDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _BalanceDto&&(identical(other.balanceTiyn, balanceTiyn) || other.balanceTiyn == balanceTiyn)&&(identical(other.availableTiyn, availableTiyn) || other.availableTiyn == availableTiyn));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,balanceTiyn,availableTiyn);

@override
String toString() {
  return 'BalanceDto(balanceTiyn: $balanceTiyn, availableTiyn: $availableTiyn)';
}


}

/// @nodoc
abstract mixin class _$BalanceDtoCopyWith<$Res> implements $BalanceDtoCopyWith<$Res> {
  factory _$BalanceDtoCopyWith(_BalanceDto value, $Res Function(_BalanceDto) _then) = __$BalanceDtoCopyWithImpl;
@override @useResult
$Res call({
 int balanceTiyn, int availableTiyn
});




}
/// @nodoc
class __$BalanceDtoCopyWithImpl<$Res>
    implements _$BalanceDtoCopyWith<$Res> {
  __$BalanceDtoCopyWithImpl(this._self, this._then);

  final _BalanceDto _self;
  final $Res Function(_BalanceDto) _then;

/// Create a copy of BalanceDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? balanceTiyn = null,Object? availableTiyn = null,}) {
  return _then(_BalanceDto(
balanceTiyn: null == balanceTiyn ? _self.balanceTiyn : balanceTiyn // ignore: cast_nullable_to_non_nullable
as int,availableTiyn: null == availableTiyn ? _self.availableTiyn : availableTiyn // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}

// dart format on
