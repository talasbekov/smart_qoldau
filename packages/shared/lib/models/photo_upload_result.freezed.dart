// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'photo_upload_result.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$PhotoUploadedDto {

 ProfileFieldStatus get status;
/// Create a copy of PhotoUploadedDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PhotoUploadedDtoCopyWith<PhotoUploadedDto> get copyWith => _$PhotoUploadedDtoCopyWithImpl<PhotoUploadedDto>(this as PhotoUploadedDto, _$identity);

  /// Serializes this PhotoUploadedDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PhotoUploadedDto&&(identical(other.status, status) || other.status == status));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,status);

@override
String toString() {
  return 'PhotoUploadedDto(status: $status)';
}


}

/// @nodoc
abstract mixin class $PhotoUploadedDtoCopyWith<$Res>  {
  factory $PhotoUploadedDtoCopyWith(PhotoUploadedDto value, $Res Function(PhotoUploadedDto) _then) = _$PhotoUploadedDtoCopyWithImpl;
@useResult
$Res call({
 ProfileFieldStatus status
});




}
/// @nodoc
class _$PhotoUploadedDtoCopyWithImpl<$Res>
    implements $PhotoUploadedDtoCopyWith<$Res> {
  _$PhotoUploadedDtoCopyWithImpl(this._self, this._then);

  final PhotoUploadedDto _self;
  final $Res Function(PhotoUploadedDto) _then;

/// Create a copy of PhotoUploadedDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? status = null,}) {
  return _then(PhotoUploadedDto(
status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as ProfileFieldStatus,
  ));
}

}


/// Adds pattern-matching-related methods to [PhotoUploadedDto].
extension PhotoUploadedDtoPatterns on PhotoUploadedDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PhotoUploadedDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PhotoUploadedDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PhotoUploadedDto value)  $default,){
final _that = this;
switch (_that) {
case _PhotoUploadedDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PhotoUploadedDto value)?  $default,){
final _that = this;
switch (_that) {
case _PhotoUploadedDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( ProfileFieldStatus status)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PhotoUploadedDto() when $default != null:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( ProfileFieldStatus status)  $default,) {final _that = this;
switch (_that) {
case _PhotoUploadedDto():
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( ProfileFieldStatus status)?  $default,) {final _that = this;
switch (_that) {
case _PhotoUploadedDto() when $default != null:
return $default(_that.status);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PhotoUploadedDto implements PhotoUploadedDto {
  const _PhotoUploadedDto({required this.status});
  factory _PhotoUploadedDto.fromJson(Map<String, dynamic> json) => _$PhotoUploadedDtoFromJson(json);

@override final  ProfileFieldStatus status;

/// Create a copy of PhotoUploadedDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PhotoUploadedDtoCopyWith<_PhotoUploadedDto> get copyWith => __$PhotoUploadedDtoCopyWithImpl<_PhotoUploadedDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PhotoUploadedDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _PhotoUploadedDto&&(identical(other.status, status) || other.status == status));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,status);

@override
String toString() {
  return 'PhotoUploadedDto(status: $status)';
}


}

/// @nodoc
abstract mixin class _$PhotoUploadedDtoCopyWith<$Res> implements $PhotoUploadedDtoCopyWith<$Res> {
  factory _$PhotoUploadedDtoCopyWith(_PhotoUploadedDto value, $Res Function(_PhotoUploadedDto) _then) = __$PhotoUploadedDtoCopyWithImpl;
@override @useResult
$Res call({
 ProfileFieldStatus status
});




}
/// @nodoc
class __$PhotoUploadedDtoCopyWithImpl<$Res>
    implements _$PhotoUploadedDtoCopyWith<$Res> {
  __$PhotoUploadedDtoCopyWithImpl(this._self, this._then);

  final _PhotoUploadedDto _self;
  final $Res Function(_PhotoUploadedDto) _then;

/// Create a copy of PhotoUploadedDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? status = null,}) {
  return _then(_PhotoUploadedDto(
status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as ProfileFieldStatus,
  ));
}


}

// dart format on
