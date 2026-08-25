// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'earnings.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$EarningsItemDto {

 String get consultationId; int get priceTiyn; int get commissionTiyn; int get netTiyn; DateTime get createdAt;
/// Create a copy of EarningsItemDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$EarningsItemDtoCopyWith<EarningsItemDto> get copyWith => _$EarningsItemDtoCopyWithImpl<EarningsItemDto>(this as EarningsItemDto, _$identity);

  /// Serializes this EarningsItemDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is EarningsItemDto&&(identical(other.consultationId, consultationId) || other.consultationId == consultationId)&&(identical(other.priceTiyn, priceTiyn) || other.priceTiyn == priceTiyn)&&(identical(other.commissionTiyn, commissionTiyn) || other.commissionTiyn == commissionTiyn)&&(identical(other.netTiyn, netTiyn) || other.netTiyn == netTiyn)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,consultationId,priceTiyn,commissionTiyn,netTiyn,createdAt);

@override
String toString() {
  return 'EarningsItemDto(consultationId: $consultationId, priceTiyn: $priceTiyn, commissionTiyn: $commissionTiyn, netTiyn: $netTiyn, createdAt: $createdAt)';
}


}

/// @nodoc
abstract mixin class $EarningsItemDtoCopyWith<$Res>  {
  factory $EarningsItemDtoCopyWith(EarningsItemDto value, $Res Function(EarningsItemDto) _then) = _$EarningsItemDtoCopyWithImpl;
@useResult
$Res call({
 String consultationId, int priceTiyn, int commissionTiyn, int netTiyn, DateTime createdAt
});




}
/// @nodoc
class _$EarningsItemDtoCopyWithImpl<$Res>
    implements $EarningsItemDtoCopyWith<$Res> {
  _$EarningsItemDtoCopyWithImpl(this._self, this._then);

  final EarningsItemDto _self;
  final $Res Function(EarningsItemDto) _then;

/// Create a copy of EarningsItemDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? consultationId = null,Object? priceTiyn = null,Object? commissionTiyn = null,Object? netTiyn = null,Object? createdAt = null,}) {
  return _then(EarningsItemDto(
consultationId: null == consultationId ? _self.consultationId : consultationId // ignore: cast_nullable_to_non_nullable
as String,priceTiyn: null == priceTiyn ? _self.priceTiyn : priceTiyn // ignore: cast_nullable_to_non_nullable
as int,commissionTiyn: null == commissionTiyn ? _self.commissionTiyn : commissionTiyn // ignore: cast_nullable_to_non_nullable
as int,netTiyn: null == netTiyn ? _self.netTiyn : netTiyn // ignore: cast_nullable_to_non_nullable
as int,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,
  ));
}

}


/// Adds pattern-matching-related methods to [EarningsItemDto].
extension EarningsItemDtoPatterns on EarningsItemDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _EarningsItemDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _EarningsItemDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _EarningsItemDto value)  $default,){
final _that = this;
switch (_that) {
case _EarningsItemDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _EarningsItemDto value)?  $default,){
final _that = this;
switch (_that) {
case _EarningsItemDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String consultationId,  int priceTiyn,  int commissionTiyn,  int netTiyn,  DateTime createdAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _EarningsItemDto() when $default != null:
return $default(_that.consultationId,_that.priceTiyn,_that.commissionTiyn,_that.netTiyn,_that.createdAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String consultationId,  int priceTiyn,  int commissionTiyn,  int netTiyn,  DateTime createdAt)  $default,) {final _that = this;
switch (_that) {
case _EarningsItemDto():
return $default(_that.consultationId,_that.priceTiyn,_that.commissionTiyn,_that.netTiyn,_that.createdAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String consultationId,  int priceTiyn,  int commissionTiyn,  int netTiyn,  DateTime createdAt)?  $default,) {final _that = this;
switch (_that) {
case _EarningsItemDto() when $default != null:
return $default(_that.consultationId,_that.priceTiyn,_that.commissionTiyn,_that.netTiyn,_that.createdAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _EarningsItemDto implements EarningsItemDto {
  const _EarningsItemDto({required this.consultationId, required this.priceTiyn, required this.commissionTiyn, required this.netTiyn, required this.createdAt});
  factory _EarningsItemDto.fromJson(Map<String, dynamic> json) => _$EarningsItemDtoFromJson(json);

@override final  String consultationId;
@override final  int priceTiyn;
@override final  int commissionTiyn;
@override final  int netTiyn;
@override final  DateTime createdAt;

/// Create a copy of EarningsItemDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$EarningsItemDtoCopyWith<_EarningsItemDto> get copyWith => __$EarningsItemDtoCopyWithImpl<_EarningsItemDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$EarningsItemDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _EarningsItemDto&&(identical(other.consultationId, consultationId) || other.consultationId == consultationId)&&(identical(other.priceTiyn, priceTiyn) || other.priceTiyn == priceTiyn)&&(identical(other.commissionTiyn, commissionTiyn) || other.commissionTiyn == commissionTiyn)&&(identical(other.netTiyn, netTiyn) || other.netTiyn == netTiyn)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,consultationId,priceTiyn,commissionTiyn,netTiyn,createdAt);

@override
String toString() {
  return 'EarningsItemDto(consultationId: $consultationId, priceTiyn: $priceTiyn, commissionTiyn: $commissionTiyn, netTiyn: $netTiyn, createdAt: $createdAt)';
}


}

/// @nodoc
abstract mixin class _$EarningsItemDtoCopyWith<$Res> implements $EarningsItemDtoCopyWith<$Res> {
  factory _$EarningsItemDtoCopyWith(_EarningsItemDto value, $Res Function(_EarningsItemDto) _then) = __$EarningsItemDtoCopyWithImpl;
@override @useResult
$Res call({
 String consultationId, int priceTiyn, int commissionTiyn, int netTiyn, DateTime createdAt
});




}
/// @nodoc
class __$EarningsItemDtoCopyWithImpl<$Res>
    implements _$EarningsItemDtoCopyWith<$Res> {
  __$EarningsItemDtoCopyWithImpl(this._self, this._then);

  final _EarningsItemDto _self;
  final $Res Function(_EarningsItemDto) _then;

/// Create a copy of EarningsItemDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? consultationId = null,Object? priceTiyn = null,Object? commissionTiyn = null,Object? netTiyn = null,Object? createdAt = null,}) {
  return _then(_EarningsItemDto(
consultationId: null == consultationId ? _self.consultationId : consultationId // ignore: cast_nullable_to_non_nullable
as String,priceTiyn: null == priceTiyn ? _self.priceTiyn : priceTiyn // ignore: cast_nullable_to_non_nullable
as int,commissionTiyn: null == commissionTiyn ? _self.commissionTiyn : commissionTiyn // ignore: cast_nullable_to_non_nullable
as int,netTiyn: null == netTiyn ? _self.netTiyn : netTiyn // ignore: cast_nullable_to_non_nullable
as int,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,
  ));
}


}


/// @nodoc
mixin _$EarningsDto {

 int get balanceTiyn; List<EarningsItemDto> get items;
/// Create a copy of EarningsDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$EarningsDtoCopyWith<EarningsDto> get copyWith => _$EarningsDtoCopyWithImpl<EarningsDto>(this as EarningsDto, _$identity);

  /// Serializes this EarningsDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is EarningsDto&&(identical(other.balanceTiyn, balanceTiyn) || other.balanceTiyn == balanceTiyn)&&const DeepCollectionEquality().equals(other.items, items));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,balanceTiyn,const DeepCollectionEquality().hash(items));

@override
String toString() {
  return 'EarningsDto(balanceTiyn: $balanceTiyn, items: $items)';
}


}

/// @nodoc
abstract mixin class $EarningsDtoCopyWith<$Res>  {
  factory $EarningsDtoCopyWith(EarningsDto value, $Res Function(EarningsDto) _then) = _$EarningsDtoCopyWithImpl;
@useResult
$Res call({
 int balanceTiyn, List<EarningsItemDto> items
});




}
/// @nodoc
class _$EarningsDtoCopyWithImpl<$Res>
    implements $EarningsDtoCopyWith<$Res> {
  _$EarningsDtoCopyWithImpl(this._self, this._then);

  final EarningsDto _self;
  final $Res Function(EarningsDto) _then;

/// Create a copy of EarningsDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? balanceTiyn = null,Object? items = null,}) {
  return _then(EarningsDto(
balanceTiyn: null == balanceTiyn ? _self.balanceTiyn : balanceTiyn // ignore: cast_nullable_to_non_nullable
as int,items: null == items ? _self.items : items // ignore: cast_nullable_to_non_nullable
as List<EarningsItemDto>,
  ));
}

}


/// Adds pattern-matching-related methods to [EarningsDto].
extension EarningsDtoPatterns on EarningsDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _EarningsDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _EarningsDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _EarningsDto value)  $default,){
final _that = this;
switch (_that) {
case _EarningsDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _EarningsDto value)?  $default,){
final _that = this;
switch (_that) {
case _EarningsDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int balanceTiyn,  List<EarningsItemDto> items)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _EarningsDto() when $default != null:
return $default(_that.balanceTiyn,_that.items);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int balanceTiyn,  List<EarningsItemDto> items)  $default,) {final _that = this;
switch (_that) {
case _EarningsDto():
return $default(_that.balanceTiyn,_that.items);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int balanceTiyn,  List<EarningsItemDto> items)?  $default,) {final _that = this;
switch (_that) {
case _EarningsDto() when $default != null:
return $default(_that.balanceTiyn,_that.items);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _EarningsDto implements EarningsDto {
  const _EarningsDto({required this.balanceTiyn, required  List<EarningsItemDto> items}): _items = items;
  factory _EarningsDto.fromJson(Map<String, dynamic> json) => _$EarningsDtoFromJson(json);

@override final  int balanceTiyn;
 final  List<EarningsItemDto> _items;
@override List<EarningsItemDto> get items {
  if (_items is EqualUnmodifiableListView) return _items;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_items);
}


/// Create a copy of EarningsDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$EarningsDtoCopyWith<_EarningsDto> get copyWith => __$EarningsDtoCopyWithImpl<_EarningsDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$EarningsDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _EarningsDto&&(identical(other.balanceTiyn, balanceTiyn) || other.balanceTiyn == balanceTiyn)&&const DeepCollectionEquality().equals(other._items, _items));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,balanceTiyn,const DeepCollectionEquality().hash(_items));

@override
String toString() {
  return 'EarningsDto(balanceTiyn: $balanceTiyn, items: $items)';
}


}

/// @nodoc
abstract mixin class _$EarningsDtoCopyWith<$Res> implements $EarningsDtoCopyWith<$Res> {
  factory _$EarningsDtoCopyWith(_EarningsDto value, $Res Function(_EarningsDto) _then) = __$EarningsDtoCopyWithImpl;
@override @useResult
$Res call({
 int balanceTiyn, List<EarningsItemDto> items
});




}
/// @nodoc
class __$EarningsDtoCopyWithImpl<$Res>
    implements _$EarningsDtoCopyWith<$Res> {
  __$EarningsDtoCopyWithImpl(this._self, this._then);

  final _EarningsDto _self;
  final $Res Function(_EarningsDto) _then;

/// Create a copy of EarningsDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? balanceTiyn = null,Object? items = null,}) {
  return _then(_EarningsDto(
balanceTiyn: null == balanceTiyn ? _self.balanceTiyn : balanceTiyn // ignore: cast_nullable_to_non_nullable
as int,items: null == items ? _self._items : items // ignore: cast_nullable_to_non_nullable
as List<EarningsItemDto>,
  ));
}


}

// dart format on
