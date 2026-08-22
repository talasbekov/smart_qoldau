// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'online_count.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$OnlineCount {

 int get count;
/// Create a copy of OnlineCount
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$OnlineCountCopyWith<OnlineCount> get copyWith => _$OnlineCountCopyWithImpl<OnlineCount>(this as OnlineCount, _$identity);

  /// Serializes this OnlineCount to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is OnlineCount&&(identical(other.count, count) || other.count == count));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,count);

@override
String toString() {
  return 'OnlineCount(count: $count)';
}


}

/// @nodoc
abstract mixin class $OnlineCountCopyWith<$Res>  {
  factory $OnlineCountCopyWith(OnlineCount value, $Res Function(OnlineCount) _then) = _$OnlineCountCopyWithImpl;
@useResult
$Res call({
 int count
});




}
/// @nodoc
class _$OnlineCountCopyWithImpl<$Res>
    implements $OnlineCountCopyWith<$Res> {
  _$OnlineCountCopyWithImpl(this._self, this._then);

  final OnlineCount _self;
  final $Res Function(OnlineCount) _then;

/// Create a copy of OnlineCount
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? count = null,}) {
  return _then(OnlineCount(
count: null == count ? _self.count : count // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [OnlineCount].
extension OnlineCountPatterns on OnlineCount {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _OnlineCount value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _OnlineCount() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _OnlineCount value)  $default,){
final _that = this;
switch (_that) {
case _OnlineCount():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _OnlineCount value)?  $default,){
final _that = this;
switch (_that) {
case _OnlineCount() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int count)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _OnlineCount() when $default != null:
return $default(_that.count);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int count)  $default,) {final _that = this;
switch (_that) {
case _OnlineCount():
return $default(_that.count);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int count)?  $default,) {final _that = this;
switch (_that) {
case _OnlineCount() when $default != null:
return $default(_that.count);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _OnlineCount implements OnlineCount {
  const _OnlineCount({required this.count});
  factory _OnlineCount.fromJson(Map<String, dynamic> json) => _$OnlineCountFromJson(json);

@override final  int count;

/// Create a copy of OnlineCount
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$OnlineCountCopyWith<_OnlineCount> get copyWith => __$OnlineCountCopyWithImpl<_OnlineCount>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$OnlineCountToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _OnlineCount&&(identical(other.count, count) || other.count == count));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,count);

@override
String toString() {
  return 'OnlineCount(count: $count)';
}


}

/// @nodoc
abstract mixin class _$OnlineCountCopyWith<$Res> implements $OnlineCountCopyWith<$Res> {
  factory _$OnlineCountCopyWith(_OnlineCount value, $Res Function(_OnlineCount) _then) = __$OnlineCountCopyWithImpl;
@override @useResult
$Res call({
 int count
});




}
/// @nodoc
class __$OnlineCountCopyWithImpl<$Res>
    implements _$OnlineCountCopyWith<$Res> {
  __$OnlineCountCopyWithImpl(this._self, this._then);

  final _OnlineCount _self;
  final $Res Function(_OnlineCount) _then;

/// Create a copy of OnlineCount
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? count = null,}) {
  return _then(_OnlineCount(
count: null == count ? _self.count : count // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}

// dart format on
