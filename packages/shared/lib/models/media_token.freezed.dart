// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'media_token.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$MediaToken {

 String get token; String get url; String get room;
/// Create a copy of MediaToken
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$MediaTokenCopyWith<MediaToken> get copyWith => _$MediaTokenCopyWithImpl<MediaToken>(this as MediaToken, _$identity);

  /// Serializes this MediaToken to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is MediaToken&&(identical(other.token, token) || other.token == token)&&(identical(other.url, url) || other.url == url)&&(identical(other.room, room) || other.room == room));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,token,url,room);

@override
String toString() {
  return 'MediaToken(token: $token, url: $url, room: $room)';
}


}

/// @nodoc
abstract mixin class $MediaTokenCopyWith<$Res>  {
  factory $MediaTokenCopyWith(MediaToken value, $Res Function(MediaToken) _then) = _$MediaTokenCopyWithImpl;
@useResult
$Res call({
 String token, String url, String room
});




}
/// @nodoc
class _$MediaTokenCopyWithImpl<$Res>
    implements $MediaTokenCopyWith<$Res> {
  _$MediaTokenCopyWithImpl(this._self, this._then);

  final MediaToken _self;
  final $Res Function(MediaToken) _then;

/// Create a copy of MediaToken
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? token = null,Object? url = null,Object? room = null,}) {
  return _then(MediaToken(
token: null == token ? _self.token : token // ignore: cast_nullable_to_non_nullable
as String,url: null == url ? _self.url : url // ignore: cast_nullable_to_non_nullable
as String,room: null == room ? _self.room : room // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [MediaToken].
extension MediaTokenPatterns on MediaToken {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _MediaToken value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _MediaToken() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _MediaToken value)  $default,){
final _that = this;
switch (_that) {
case _MediaToken():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _MediaToken value)?  $default,){
final _that = this;
switch (_that) {
case _MediaToken() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String token,  String url,  String room)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _MediaToken() when $default != null:
return $default(_that.token,_that.url,_that.room);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String token,  String url,  String room)  $default,) {final _that = this;
switch (_that) {
case _MediaToken():
return $default(_that.token,_that.url,_that.room);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String token,  String url,  String room)?  $default,) {final _that = this;
switch (_that) {
case _MediaToken() when $default != null:
return $default(_that.token,_that.url,_that.room);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _MediaToken implements MediaToken {
  const _MediaToken({required this.token, required this.url, required this.room});
  factory _MediaToken.fromJson(Map<String, dynamic> json) => _$MediaTokenFromJson(json);

@override final  String token;
@override final  String url;
@override final  String room;

/// Create a copy of MediaToken
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$MediaTokenCopyWith<_MediaToken> get copyWith => __$MediaTokenCopyWithImpl<_MediaToken>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$MediaTokenToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _MediaToken&&(identical(other.token, token) || other.token == token)&&(identical(other.url, url) || other.url == url)&&(identical(other.room, room) || other.room == room));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,token,url,room);

@override
String toString() {
  return 'MediaToken(token: $token, url: $url, room: $room)';
}


}

/// @nodoc
abstract mixin class _$MediaTokenCopyWith<$Res> implements $MediaTokenCopyWith<$Res> {
  factory _$MediaTokenCopyWith(_MediaToken value, $Res Function(_MediaToken) _then) = __$MediaTokenCopyWithImpl;
@override @useResult
$Res call({
 String token, String url, String room
});




}
/// @nodoc
class __$MediaTokenCopyWithImpl<$Res>
    implements _$MediaTokenCopyWith<$Res> {
  __$MediaTokenCopyWithImpl(this._self, this._then);

  final _MediaToken _self;
  final $Res Function(_MediaToken) _then;

/// Create a copy of MediaToken
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? token = null,Object? url = null,Object? room = null,}) {
  return _then(_MediaToken(
token: null == token ? _self.token : token // ignore: cast_nullable_to_non_nullable
as String,url: null == url ? _self.url : url // ignore: cast_nullable_to_non_nullable
as String,room: null == room ? _self.room : room // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on
