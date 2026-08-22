// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'payment.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PaymentMethod {

 String get id; String get maskedPan; String get brand; String get holderName;
/// Create a copy of PaymentMethod
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PaymentMethodCopyWith<PaymentMethod> get copyWith => _$PaymentMethodCopyWithImpl<PaymentMethod>(this as PaymentMethod, _$identity);

  /// Serializes this PaymentMethod to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PaymentMethod&&(identical(other.id, id) || other.id == id)&&(identical(other.maskedPan, maskedPan) || other.maskedPan == maskedPan)&&(identical(other.brand, brand) || other.brand == brand)&&(identical(other.holderName, holderName) || other.holderName == holderName));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,maskedPan,brand,holderName);

@override
String toString() {
  return 'PaymentMethod(id: $id, maskedPan: $maskedPan, brand: $brand, holderName: $holderName)';
}


}

/// @nodoc
abstract mixin class $PaymentMethodCopyWith<$Res>  {
  factory $PaymentMethodCopyWith(PaymentMethod value, $Res Function(PaymentMethod) _then) = _$PaymentMethodCopyWithImpl;
@useResult
$Res call({
 String id, String maskedPan, String brand, String holderName
});




}
/// @nodoc
class _$PaymentMethodCopyWithImpl<$Res>
    implements $PaymentMethodCopyWith<$Res> {
  _$PaymentMethodCopyWithImpl(this._self, this._then);

  final PaymentMethod _self;
  final $Res Function(PaymentMethod) _then;

/// Create a copy of PaymentMethod
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? maskedPan = null,Object? brand = null,Object? holderName = null,}) {
  return _then(PaymentMethod(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,maskedPan: null == maskedPan ? _self.maskedPan : maskedPan // ignore: cast_nullable_to_non_nullable
as String,brand: null == brand ? _self.brand : brand // ignore: cast_nullable_to_non_nullable
as String,holderName: null == holderName ? _self.holderName : holderName // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [PaymentMethod].
extension PaymentMethodPatterns on PaymentMethod {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PaymentMethod value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PaymentMethod() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PaymentMethod value)  $default,){
final _that = this;
switch (_that) {
case _PaymentMethod():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PaymentMethod value)?  $default,){
final _that = this;
switch (_that) {
case _PaymentMethod() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String maskedPan,  String brand,  String holderName)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PaymentMethod() when $default != null:
return $default(_that.id,_that.maskedPan,_that.brand,_that.holderName);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String maskedPan,  String brand,  String holderName)  $default,) {final _that = this;
switch (_that) {
case _PaymentMethod():
return $default(_that.id,_that.maskedPan,_that.brand,_that.holderName);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String maskedPan,  String brand,  String holderName)?  $default,) {final _that = this;
switch (_that) {
case _PaymentMethod() when $default != null:
return $default(_that.id,_that.maskedPan,_that.brand,_that.holderName);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PaymentMethod implements PaymentMethod {
  const _PaymentMethod({required this.id, required this.maskedPan, required this.brand, required this.holderName});
  factory _PaymentMethod.fromJson(Map<String, dynamic> json) => _$PaymentMethodFromJson(json);

@override final  String id;
@override final  String maskedPan;
@override final  String brand;
@override final  String holderName;

/// Create a copy of PaymentMethod
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PaymentMethodCopyWith<_PaymentMethod> get copyWith => __$PaymentMethodCopyWithImpl<_PaymentMethod>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PaymentMethodToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PaymentMethod&&(identical(other.id, id) || other.id == id)&&(identical(other.maskedPan, maskedPan) || other.maskedPan == maskedPan)&&(identical(other.brand, brand) || other.brand == brand)&&(identical(other.holderName, holderName) || other.holderName == holderName));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,maskedPan,brand,holderName);

@override
String toString() {
  return 'PaymentMethod(id: $id, maskedPan: $maskedPan, brand: $brand, holderName: $holderName)';
}


}

/// @nodoc
abstract mixin class _$PaymentMethodCopyWith<$Res> implements $PaymentMethodCopyWith<$Res> {
  factory _$PaymentMethodCopyWith(_PaymentMethod value, $Res Function(_PaymentMethod) _then) = __$PaymentMethodCopyWithImpl;
@override @useResult
$Res call({
 String id, String maskedPan, String brand, String holderName
});




}
/// @nodoc
class __$PaymentMethodCopyWithImpl<$Res>
    implements _$PaymentMethodCopyWith<$Res> {
  __$PaymentMethodCopyWithImpl(this._self, this._then);

  final _PaymentMethod _self;
  final $Res Function(_PaymentMethod) _then;

/// Create a copy of PaymentMethod
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? maskedPan = null,Object? brand = null,Object? holderName = null,}) {
  return _then(_PaymentMethod(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,maskedPan: null == maskedPan ? _self.maskedPan : maskedPan // ignore: cast_nullable_to_non_nullable
as String,brand: null == brand ? _self.brand : brand // ignore: cast_nullable_to_non_nullable
as String,holderName: null == holderName ? _self.holderName : holderName // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$PaymentStatusInfo {

 PaymentStatus get status; int get amountTiyn; String get maskedPan;
/// Create a copy of PaymentStatusInfo
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PaymentStatusInfoCopyWith<PaymentStatusInfo> get copyWith => _$PaymentStatusInfoCopyWithImpl<PaymentStatusInfo>(this as PaymentStatusInfo, _$identity);

  /// Serializes this PaymentStatusInfo to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PaymentStatusInfo&&(identical(other.status, status) || other.status == status)&&(identical(other.amountTiyn, amountTiyn) || other.amountTiyn == amountTiyn)&&(identical(other.maskedPan, maskedPan) || other.maskedPan == maskedPan));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,status,amountTiyn,maskedPan);

@override
String toString() {
  return 'PaymentStatusInfo(status: $status, amountTiyn: $amountTiyn, maskedPan: $maskedPan)';
}


}

/// @nodoc
abstract mixin class $PaymentStatusInfoCopyWith<$Res>  {
  factory $PaymentStatusInfoCopyWith(PaymentStatusInfo value, $Res Function(PaymentStatusInfo) _then) = _$PaymentStatusInfoCopyWithImpl;
@useResult
$Res call({
 PaymentStatus status, int amountTiyn, String maskedPan
});




}
/// @nodoc
class _$PaymentStatusInfoCopyWithImpl<$Res>
    implements $PaymentStatusInfoCopyWith<$Res> {
  _$PaymentStatusInfoCopyWithImpl(this._self, this._then);

  final PaymentStatusInfo _self;
  final $Res Function(PaymentStatusInfo) _then;

/// Create a copy of PaymentStatusInfo
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? status = null,Object? amountTiyn = null,Object? maskedPan = null,}) {
  return _then(PaymentStatusInfo(
status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as PaymentStatus,amountTiyn: null == amountTiyn ? _self.amountTiyn : amountTiyn // ignore: cast_nullable_to_non_nullable
as int,maskedPan: null == maskedPan ? _self.maskedPan : maskedPan // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [PaymentStatusInfo].
extension PaymentStatusInfoPatterns on PaymentStatusInfo {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PaymentStatusInfo value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PaymentStatusInfo() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PaymentStatusInfo value)  $default,){
final _that = this;
switch (_that) {
case _PaymentStatusInfo():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PaymentStatusInfo value)?  $default,){
final _that = this;
switch (_that) {
case _PaymentStatusInfo() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( PaymentStatus status,  int amountTiyn,  String maskedPan)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PaymentStatusInfo() when $default != null:
return $default(_that.status,_that.amountTiyn,_that.maskedPan);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( PaymentStatus status,  int amountTiyn,  String maskedPan)  $default,) {final _that = this;
switch (_that) {
case _PaymentStatusInfo():
return $default(_that.status,_that.amountTiyn,_that.maskedPan);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( PaymentStatus status,  int amountTiyn,  String maskedPan)?  $default,) {final _that = this;
switch (_that) {
case _PaymentStatusInfo() when $default != null:
return $default(_that.status,_that.amountTiyn,_that.maskedPan);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PaymentStatusInfo implements PaymentStatusInfo {
  const _PaymentStatusInfo({required this.status, required this.amountTiyn, required this.maskedPan});
  factory _PaymentStatusInfo.fromJson(Map<String, dynamic> json) => _$PaymentStatusInfoFromJson(json);

@override final  PaymentStatus status;
@override final  int amountTiyn;
@override final  String maskedPan;

/// Create a copy of PaymentStatusInfo
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PaymentStatusInfoCopyWith<_PaymentStatusInfo> get copyWith => __$PaymentStatusInfoCopyWithImpl<_PaymentStatusInfo>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PaymentStatusInfoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PaymentStatusInfo&&(identical(other.status, status) || other.status == status)&&(identical(other.amountTiyn, amountTiyn) || other.amountTiyn == amountTiyn)&&(identical(other.maskedPan, maskedPan) || other.maskedPan == maskedPan));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,status,amountTiyn,maskedPan);

@override
String toString() {
  return 'PaymentStatusInfo(status: $status, amountTiyn: $amountTiyn, maskedPan: $maskedPan)';
}


}

/// @nodoc
abstract mixin class _$PaymentStatusInfoCopyWith<$Res> implements $PaymentStatusInfoCopyWith<$Res> {
  factory _$PaymentStatusInfoCopyWith(_PaymentStatusInfo value, $Res Function(_PaymentStatusInfo) _then) = __$PaymentStatusInfoCopyWithImpl;
@override @useResult
$Res call({
 PaymentStatus status, int amountTiyn, String maskedPan
});




}
/// @nodoc
class __$PaymentStatusInfoCopyWithImpl<$Res>
    implements _$PaymentStatusInfoCopyWith<$Res> {
  __$PaymentStatusInfoCopyWithImpl(this._self, this._then);

  final _PaymentStatusInfo _self;
  final $Res Function(_PaymentStatusInfo) _then;

/// Create a copy of PaymentStatusInfo
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? status = null,Object? amountTiyn = null,Object? maskedPan = null,}) {
  return _then(_PaymentStatusInfo(
status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as PaymentStatus,amountTiyn: null == amountTiyn ? _self.amountTiyn : amountTiyn // ignore: cast_nullable_to_non_nullable
as int,maskedPan: null == maskedPan ? _self.maskedPan : maskedPan // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$PayResult {

 PaymentStatus get status;
/// Create a copy of PayResult
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PayResultCopyWith<PayResult> get copyWith => _$PayResultCopyWithImpl<PayResult>(this as PayResult, _$identity);

  /// Serializes this PayResult to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PayResult&&(identical(other.status, status) || other.status == status));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,status);

@override
String toString() {
  return 'PayResult(status: $status)';
}


}

/// @nodoc
abstract mixin class $PayResultCopyWith<$Res>  {
  factory $PayResultCopyWith(PayResult value, $Res Function(PayResult) _then) = _$PayResultCopyWithImpl;
@useResult
$Res call({
 PaymentStatus status
});




}
/// @nodoc
class _$PayResultCopyWithImpl<$Res>
    implements $PayResultCopyWith<$Res> {
  _$PayResultCopyWithImpl(this._self, this._then);

  final PayResult _self;
  final $Res Function(PayResult) _then;

/// Create a copy of PayResult
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? status = null,}) {
  return _then(PayResult(
status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as PaymentStatus,
  ));
}

}


/// Adds pattern-matching-related methods to [PayResult].
extension PayResultPatterns on PayResult {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PayResult value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PayResult() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PayResult value)  $default,){
final _that = this;
switch (_that) {
case _PayResult():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PayResult value)?  $default,){
final _that = this;
switch (_that) {
case _PayResult() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( PaymentStatus status)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PayResult() when $default != null:
return $default(_that.status);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( PaymentStatus status)  $default,) {final _that = this;
switch (_that) {
case _PayResult():
return $default(_that.status);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( PaymentStatus status)?  $default,) {final _that = this;
switch (_that) {
case _PayResult() when $default != null:
return $default(_that.status);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PayResult implements PayResult {
  const _PayResult({required this.status});
  factory _PayResult.fromJson(Map<String, dynamic> json) => _$PayResultFromJson(json);

@override final  PaymentStatus status;

/// Create a copy of PayResult
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PayResultCopyWith<_PayResult> get copyWith => __$PayResultCopyWithImpl<_PayResult>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PayResultToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PayResult&&(identical(other.status, status) || other.status == status));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,status);

@override
String toString() {
  return 'PayResult(status: $status)';
}


}

/// @nodoc
abstract mixin class _$PayResultCopyWith<$Res> implements $PayResultCopyWith<$Res> {
  factory _$PayResultCopyWith(_PayResult value, $Res Function(_PayResult) _then) = __$PayResultCopyWithImpl;
@override @useResult
$Res call({
 PaymentStatus status
});




}
/// @nodoc
class __$PayResultCopyWithImpl<$Res>
    implements _$PayResultCopyWith<$Res> {
  __$PayResultCopyWithImpl(this._self, this._then);

  final _PayResult _self;
  final $Res Function(_PayResult) _then;

/// Create a copy of PayResult
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? status = null,}) {
  return _then(_PayResult(
status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as PaymentStatus,
  ));
}


}

// dart format on
