// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'expert_note.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$ExpertNoteDto {

 String? get text; DateTime? get updatedAt;
/// Create a copy of ExpertNoteDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ExpertNoteDtoCopyWith<ExpertNoteDto> get copyWith => _$ExpertNoteDtoCopyWithImpl<ExpertNoteDto>(this as ExpertNoteDto, _$identity);

  /// Serializes this ExpertNoteDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ExpertNoteDto&&(identical(other.text, text) || other.text == text)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,text,updatedAt);

@override
String toString() {
  return 'ExpertNoteDto(text: $text, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class $ExpertNoteDtoCopyWith<$Res>  {
  factory $ExpertNoteDtoCopyWith(ExpertNoteDto value, $Res Function(ExpertNoteDto) _then) = _$ExpertNoteDtoCopyWithImpl;
@useResult
$Res call({
 String? text, DateTime? updatedAt
});




}
/// @nodoc
class _$ExpertNoteDtoCopyWithImpl<$Res>
    implements $ExpertNoteDtoCopyWith<$Res> {
  _$ExpertNoteDtoCopyWithImpl(this._self, this._then);

  final ExpertNoteDto _self;
  final $Res Function(ExpertNoteDto) _then;

/// Create a copy of ExpertNoteDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? text = freezed,Object? updatedAt = freezed,}) {
  return _then(ExpertNoteDto(
text: freezed == text ? _self.text : text // ignore: cast_nullable_to_non_nullable
as String?,updatedAt: freezed == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}

}


/// Adds pattern-matching-related methods to [ExpertNoteDto].
extension ExpertNoteDtoPatterns on ExpertNoteDto {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ExpertNoteDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ExpertNoteDto() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ExpertNoteDto value)  $default,){
final _that = this;
switch (_that) {
case _ExpertNoteDto():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ExpertNoteDto value)?  $default,){
final _that = this;
switch (_that) {
case _ExpertNoteDto() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String? text,  DateTime? updatedAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ExpertNoteDto() when $default != null:
return $default(_that.text,_that.updatedAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String? text,  DateTime? updatedAt)  $default,) {final _that = this;
switch (_that) {
case _ExpertNoteDto():
return $default(_that.text,_that.updatedAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String? text,  DateTime? updatedAt)?  $default,) {final _that = this;
switch (_that) {
case _ExpertNoteDto() when $default != null:
return $default(_that.text,_that.updatedAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ExpertNoteDto implements ExpertNoteDto {
  const _ExpertNoteDto({this.text, this.updatedAt});
  factory _ExpertNoteDto.fromJson(Map<String, dynamic> json) => _$ExpertNoteDtoFromJson(json);

@override final  String? text;
@override final  DateTime? updatedAt;

/// Create a copy of ExpertNoteDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ExpertNoteDtoCopyWith<_ExpertNoteDto> get copyWith => __$ExpertNoteDtoCopyWithImpl<_ExpertNoteDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ExpertNoteDtoToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ExpertNoteDto&&(identical(other.text, text) || other.text == text)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,text,updatedAt);

@override
String toString() {
  return 'ExpertNoteDto(text: $text, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class _$ExpertNoteDtoCopyWith<$Res> implements $ExpertNoteDtoCopyWith<$Res> {
  factory _$ExpertNoteDtoCopyWith(_ExpertNoteDto value, $Res Function(_ExpertNoteDto) _then) = __$ExpertNoteDtoCopyWithImpl;
@override @useResult
$Res call({
 String? text, DateTime? updatedAt
});




}
/// @nodoc
class __$ExpertNoteDtoCopyWithImpl<$Res>
    implements _$ExpertNoteDtoCopyWith<$Res> {
  __$ExpertNoteDtoCopyWithImpl(this._self, this._then);

  final _ExpertNoteDto _self;
  final $Res Function(_ExpertNoteDto) _then;

/// Create a copy of ExpertNoteDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? text = freezed,Object? updatedAt = freezed,}) {
  return _then(_ExpertNoteDto(
text: freezed == text ? _self.text : text // ignore: cast_nullable_to_non_nullable
as String?,updatedAt: freezed == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,
  ));
}


}

// dart format on
