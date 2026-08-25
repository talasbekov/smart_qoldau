// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'expert_document.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$ExpertDocumentDto {

 DocumentType get type; DocumentStatus? get status; DateTime? get updatedAt;
/// Create a copy of ExpertDocumentDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ExpertDocumentDtoCopyWith<ExpertDocumentDto> get copyWith => _$ExpertDocumentDtoCopyWithImpl<ExpertDocumentDto>(this as ExpertDocumentDto, _$identity);

  /// Serializes this ExpertDocumentDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ExpertDocumentDto&&(identical(other.type, type) || other.type == type)&&(identical(other.status, status) || other.status == status)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,type,status,updatedAt);

@override
String toString() {
  return 'ExpertDocumentDto(type: $type, status: $status, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class $ExpertDocumentDtoCopyWith<$Res>  {
  factory $ExpertDocumentDtoCopyWith(ExpertDocumentDto value, $Res Function(ExpertDocumentDto) _then) = _$ExpertDocumentDtoCopyWithImpl;
@useResult
$Res call({
 DocumentType type, DocumentStatus? status, DateTime? updatedAt
});




}
/// @nodoc
class _$ExpertDocumentDtoCopyWithImpl<$Res>
    implements $ExpertDocumentDtoCopyWith<$Res> {
  _$ExpertDocumentDtoCopyWithImpl(this._self, this._then);

  final ExpertDocumentDto _self;
  final $Res Function(ExpertDocumentDto) _then;

/// Create a copy of ExpertDocumentDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? type = null,Object? status = freezed,Object? updatedAt = freezed,}) {
  return _then(ExpertDocumentDto(
type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as DocumentType,status: freezed == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as DocumentStatus?,updatedAt: freezed == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}

}


/// Adds pattern-matching-related methods to [ExpertDocumentDto].
extension ExpertDocumentDtoPatterns on ExpertDocumentDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ExpertDocumentDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ExpertDocumentDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ExpertDocumentDto value)  $default,){
final _that = this;
switch (_that) {
case _ExpertDocumentDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ExpertDocumentDto value)?  $default,){
final _that = this;
switch (_that) {
case _ExpertDocumentDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( DocumentType type,  DocumentStatus? status,  DateTime? updatedAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ExpertDocumentDto() when $default != null:
return $default(_that.type,_that.status,_that.updatedAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( DocumentType type,  DocumentStatus? status,  DateTime? updatedAt)  $default,) {final _that = this;
switch (_that) {
case _ExpertDocumentDto():
return $default(_that.type,_that.status,_that.updatedAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( DocumentType type,  DocumentStatus? status,  DateTime? updatedAt)?  $default,) {final _that = this;
switch (_that) {
case _ExpertDocumentDto() when $default != null:
return $default(_that.type,_that.status,_that.updatedAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ExpertDocumentDto implements ExpertDocumentDto {
  const _ExpertDocumentDto({required this.type, this.status, this.updatedAt});
  factory _ExpertDocumentDto.fromJson(Map<String, dynamic> json) => _$ExpertDocumentDtoFromJson(json);

@override final  DocumentType type;
@override final  DocumentStatus? status;
@override final  DateTime? updatedAt;

/// Create a copy of ExpertDocumentDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ExpertDocumentDtoCopyWith<_ExpertDocumentDto> get copyWith => __$ExpertDocumentDtoCopyWithImpl<_ExpertDocumentDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ExpertDocumentDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ExpertDocumentDto&&(identical(other.type, type) || other.type == type)&&(identical(other.status, status) || other.status == status)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,type,status,updatedAt);

@override
String toString() {
  return 'ExpertDocumentDto(type: $type, status: $status, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class _$ExpertDocumentDtoCopyWith<$Res> implements $ExpertDocumentDtoCopyWith<$Res> {
  factory _$ExpertDocumentDtoCopyWith(_ExpertDocumentDto value, $Res Function(_ExpertDocumentDto) _then) = __$ExpertDocumentDtoCopyWithImpl;
@override @useResult
$Res call({
 DocumentType type, DocumentStatus? status, DateTime? updatedAt
});




}
/// @nodoc
class __$ExpertDocumentDtoCopyWithImpl<$Res>
    implements _$ExpertDocumentDtoCopyWith<$Res> {
  __$ExpertDocumentDtoCopyWithImpl(this._self, this._then);

  final _ExpertDocumentDto _self;
  final $Res Function(_ExpertDocumentDto) _then;

/// Create a copy of ExpertDocumentDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? type = null,Object? status = freezed,Object? updatedAt = freezed,}) {
  return _then(_ExpertDocumentDto(
type: null == type ? _self.type : type // ignore: cast_nullable_to_non_nullable
as DocumentType,status: freezed == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as DocumentStatus?,updatedAt: freezed == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}


}


/// @nodoc
mixin _$SubmitVerificationDto {

 VerificationStatus get verificationStatus;
/// Create a copy of SubmitVerificationDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SubmitVerificationDtoCopyWith<SubmitVerificationDto> get copyWith => _$SubmitVerificationDtoCopyWithImpl<SubmitVerificationDto>(this as SubmitVerificationDto, _$identity);

  /// Serializes this SubmitVerificationDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SubmitVerificationDto&&(identical(other.verificationStatus, verificationStatus) || other.verificationStatus == verificationStatus));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,verificationStatus);

@override
String toString() {
  return 'SubmitVerificationDto(verificationStatus: $verificationStatus)';
}


}

/// @nodoc
abstract mixin class $SubmitVerificationDtoCopyWith<$Res>  {
  factory $SubmitVerificationDtoCopyWith(SubmitVerificationDto value, $Res Function(SubmitVerificationDto) _then) = _$SubmitVerificationDtoCopyWithImpl;
@useResult
$Res call({
 VerificationStatus verificationStatus
});




}
/// @nodoc
class _$SubmitVerificationDtoCopyWithImpl<$Res>
    implements $SubmitVerificationDtoCopyWith<$Res> {
  _$SubmitVerificationDtoCopyWithImpl(this._self, this._then);

  final SubmitVerificationDto _self;
  final $Res Function(SubmitVerificationDto) _then;

/// Create a copy of SubmitVerificationDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? verificationStatus = null,}) {
  return _then(SubmitVerificationDto(
verificationStatus: null == verificationStatus ? _self.verificationStatus : verificationStatus // ignore: cast_nullable_to_non_nullable
as VerificationStatus,
  ));
}

}


/// Adds pattern-matching-related methods to [SubmitVerificationDto].
extension SubmitVerificationDtoPatterns on SubmitVerificationDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SubmitVerificationDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SubmitVerificationDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SubmitVerificationDto value)  $default,){
final _that = this;
switch (_that) {
case _SubmitVerificationDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SubmitVerificationDto value)?  $default,){
final _that = this;
switch (_that) {
case _SubmitVerificationDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( VerificationStatus verificationStatus)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SubmitVerificationDto() when $default != null:
return $default(_that.verificationStatus);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( VerificationStatus verificationStatus)  $default,) {final _that = this;
switch (_that) {
case _SubmitVerificationDto():
return $default(_that.verificationStatus);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( VerificationStatus verificationStatus)?  $default,) {final _that = this;
switch (_that) {
case _SubmitVerificationDto() when $default != null:
return $default(_that.verificationStatus);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SubmitVerificationDto implements SubmitVerificationDto {
  const _SubmitVerificationDto({required this.verificationStatus});
  factory _SubmitVerificationDto.fromJson(Map<String, dynamic> json) => _$SubmitVerificationDtoFromJson(json);

@override final  VerificationStatus verificationStatus;

/// Create a copy of SubmitVerificationDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SubmitVerificationDtoCopyWith<_SubmitVerificationDto> get copyWith => __$SubmitVerificationDtoCopyWithImpl<_SubmitVerificationDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SubmitVerificationDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _SubmitVerificationDto&&(identical(other.verificationStatus, verificationStatus) || other.verificationStatus == verificationStatus));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,verificationStatus);

@override
String toString() {
  return 'SubmitVerificationDto(verificationStatus: $verificationStatus)';
}


}

/// @nodoc
abstract mixin class _$SubmitVerificationDtoCopyWith<$Res> implements $SubmitVerificationDtoCopyWith<$Res> {
  factory _$SubmitVerificationDtoCopyWith(_SubmitVerificationDto value, $Res Function(_SubmitVerificationDto) _then) = __$SubmitVerificationDtoCopyWithImpl;
@override @useResult
$Res call({
 VerificationStatus verificationStatus
});




}
/// @nodoc
class __$SubmitVerificationDtoCopyWithImpl<$Res>
    implements _$SubmitVerificationDtoCopyWith<$Res> {
  __$SubmitVerificationDtoCopyWithImpl(this._self, this._then);

  final _SubmitVerificationDto _self;
  final $Res Function(_SubmitVerificationDto) _then;

/// Create a copy of SubmitVerificationDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? verificationStatus = null,}) {
  return _then(_SubmitVerificationDto(
verificationStatus: null == verificationStatus ? _self.verificationStatus : verificationStatus // ignore: cast_nullable_to_non_nullable
as VerificationStatus,
  ));
}


}

// dart format on
