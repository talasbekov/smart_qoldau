// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'review.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$ReviewCreated {

 String get id; String get consultationId; int get rating; String? get publicText; DateTime get createdAt;
/// Create a copy of ReviewCreated
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ReviewCreatedCopyWith<ReviewCreated> get copyWith => _$ReviewCreatedCopyWithImpl<ReviewCreated>(this as ReviewCreated, _$identity);

  /// Serializes this ReviewCreated to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ReviewCreated&&(identical(other.id, id) || other.id == id)&&(identical(other.consultationId, consultationId) || other.consultationId == consultationId)&&(identical(other.rating, rating) || other.rating == rating)&&(identical(other.publicText, publicText) || other.publicText == publicText)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,consultationId,rating,publicText,createdAt);

@override
String toString() {
  return 'ReviewCreated(id: $id, consultationId: $consultationId, rating: $rating, publicText: $publicText, createdAt: $createdAt)';
}


}

/// @nodoc
abstract mixin class $ReviewCreatedCopyWith<$Res>  {
  factory $ReviewCreatedCopyWith(ReviewCreated value, $Res Function(ReviewCreated) _then) = _$ReviewCreatedCopyWithImpl;
@useResult
$Res call({
 String id, String consultationId, int rating, String? publicText, DateTime createdAt
});




}
/// @nodoc
class _$ReviewCreatedCopyWithImpl<$Res>
    implements $ReviewCreatedCopyWith<$Res> {
  _$ReviewCreatedCopyWithImpl(this._self, this._then);

  final ReviewCreated _self;
  final $Res Function(ReviewCreated) _then;

/// Create a copy of ReviewCreated
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? consultationId = null,Object? rating = null,Object? publicText = freezed,Object? createdAt = null,}) {
  return _then(ReviewCreated(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,consultationId: null == consultationId ? _self.consultationId : consultationId // ignore: cast_nullable_to_non_nullable
as String,rating: null == rating ? _self.rating : rating // ignore: cast_nullable_to_non_nullable
as int,publicText: freezed == publicText ? _self.publicText : publicText // ignore: cast_nullable_to_non_nullable
as String?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,
  ));
}

}


/// Adds pattern-matching-related methods to [ReviewCreated].
extension ReviewCreatedPatterns on ReviewCreated {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ReviewCreated value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ReviewCreated() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ReviewCreated value)  $default,){
final _that = this;
switch (_that) {
case _ReviewCreated():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ReviewCreated value)?  $default,){
final _that = this;
switch (_that) {
case _ReviewCreated() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String consultationId,  int rating,  String? publicText,  DateTime createdAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ReviewCreated() when $default != null:
return $default(_that.id,_that.consultationId,_that.rating,_that.publicText,_that.createdAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String consultationId,  int rating,  String? publicText,  DateTime createdAt)  $default,) {final _that = this;
switch (_that) {
case _ReviewCreated():
return $default(_that.id,_that.consultationId,_that.rating,_that.publicText,_that.createdAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String consultationId,  int rating,  String? publicText,  DateTime createdAt)?  $default,) {final _that = this;
switch (_that) {
case _ReviewCreated() when $default != null:
return $default(_that.id,_that.consultationId,_that.rating,_that.publicText,_that.createdAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ReviewCreated implements ReviewCreated {
  const _ReviewCreated({required this.id, required this.consultationId, required this.rating, this.publicText, required this.createdAt});
  factory _ReviewCreated.fromJson(Map<String, dynamic> json) => _$ReviewCreatedFromJson(json);

@override final  String id;
@override final  String consultationId;
@override final  int rating;
@override final  String? publicText;
@override final  DateTime createdAt;

/// Create a copy of ReviewCreated
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ReviewCreatedCopyWith<_ReviewCreated> get copyWith => __$ReviewCreatedCopyWithImpl<_ReviewCreated>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ReviewCreatedToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ReviewCreated&&(identical(other.id, id) || other.id == id)&&(identical(other.consultationId, consultationId) || other.consultationId == consultationId)&&(identical(other.rating, rating) || other.rating == rating)&&(identical(other.publicText, publicText) || other.publicText == publicText)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,consultationId,rating,publicText,createdAt);

@override
String toString() {
  return 'ReviewCreated(id: $id, consultationId: $consultationId, rating: $rating, publicText: $publicText, createdAt: $createdAt)';
}


}

/// @nodoc
abstract mixin class _$ReviewCreatedCopyWith<$Res> implements $ReviewCreatedCopyWith<$Res> {
  factory _$ReviewCreatedCopyWith(_ReviewCreated value, $Res Function(_ReviewCreated) _then) = __$ReviewCreatedCopyWithImpl;
@override @useResult
$Res call({
 String id, String consultationId, int rating, String? publicText, DateTime createdAt
});




}
/// @nodoc
class __$ReviewCreatedCopyWithImpl<$Res>
    implements _$ReviewCreatedCopyWith<$Res> {
  __$ReviewCreatedCopyWithImpl(this._self, this._then);

  final _ReviewCreated _self;
  final $Res Function(_ReviewCreated) _then;

/// Create a copy of ReviewCreated
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? consultationId = null,Object? rating = null,Object? publicText = freezed,Object? createdAt = null,}) {
  return _then(_ReviewCreated(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,consultationId: null == consultationId ? _self.consultationId : consultationId // ignore: cast_nullable_to_non_nullable
as String,rating: null == rating ? _self.rating : rating // ignore: cast_nullable_to_non_nullable
as int,publicText: freezed == publicText ? _self.publicText : publicText // ignore: cast_nullable_to_non_nullable
as String?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,
  ));
}


}


/// @nodoc
mixin _$ReviewItem {

 int get rating; String? get publicText; String? get expertReply; DateTime get createdAt;
/// Create a copy of ReviewItem
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ReviewItemCopyWith<ReviewItem> get copyWith => _$ReviewItemCopyWithImpl<ReviewItem>(this as ReviewItem, _$identity);

  /// Serializes this ReviewItem to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ReviewItem&&(identical(other.rating, rating) || other.rating == rating)&&(identical(other.publicText, publicText) || other.publicText == publicText)&&(identical(other.expertReply, expertReply) || other.expertReply == expertReply)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,rating,publicText,expertReply,createdAt);

@override
String toString() {
  return 'ReviewItem(rating: $rating, publicText: $publicText, expertReply: $expertReply, createdAt: $createdAt)';
}


}

/// @nodoc
abstract mixin class $ReviewItemCopyWith<$Res>  {
  factory $ReviewItemCopyWith(ReviewItem value, $Res Function(ReviewItem) _then) = _$ReviewItemCopyWithImpl;
@useResult
$Res call({
 int rating, String? publicText, String? expertReply, DateTime createdAt
});




}
/// @nodoc
class _$ReviewItemCopyWithImpl<$Res>
    implements $ReviewItemCopyWith<$Res> {
  _$ReviewItemCopyWithImpl(this._self, this._then);

  final ReviewItem _self;
  final $Res Function(ReviewItem) _then;

/// Create a copy of ReviewItem
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? rating = null,Object? publicText = freezed,Object? expertReply = freezed,Object? createdAt = null,}) {
  return _then(ReviewItem(
rating: null == rating ? _self.rating : rating // ignore: cast_nullable_to_non_nullable
as int,publicText: freezed == publicText ? _self.publicText : publicText // ignore: cast_nullable_to_non_nullable
as String?,expertReply: freezed == expertReply ? _self.expertReply : expertReply // ignore: cast_nullable_to_non_nullable
as String?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,
  ));
}

}


/// Adds pattern-matching-related methods to [ReviewItem].
extension ReviewItemPatterns on ReviewItem {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ReviewItem value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ReviewItem() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ReviewItem value)  $default,){
final _that = this;
switch (_that) {
case _ReviewItem():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ReviewItem value)?  $default,){
final _that = this;
switch (_that) {
case _ReviewItem() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int rating,  String? publicText,  String? expertReply,  DateTime createdAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ReviewItem() when $default != null:
return $default(_that.rating,_that.publicText,_that.expertReply,_that.createdAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int rating,  String? publicText,  String? expertReply,  DateTime createdAt)  $default,) {final _that = this;
switch (_that) {
case _ReviewItem():
return $default(_that.rating,_that.publicText,_that.expertReply,_that.createdAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int rating,  String? publicText,  String? expertReply,  DateTime createdAt)?  $default,) {final _that = this;
switch (_that) {
case _ReviewItem() when $default != null:
return $default(_that.rating,_that.publicText,_that.expertReply,_that.createdAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ReviewItem implements ReviewItem {
  const _ReviewItem({required this.rating, this.publicText, this.expertReply, required this.createdAt});
  factory _ReviewItem.fromJson(Map<String, dynamic> json) => _$ReviewItemFromJson(json);

@override final  int rating;
@override final  String? publicText;
@override final  String? expertReply;
@override final  DateTime createdAt;

/// Create a copy of ReviewItem
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ReviewItemCopyWith<_ReviewItem> get copyWith => __$ReviewItemCopyWithImpl<_ReviewItem>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ReviewItemToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ReviewItem&&(identical(other.rating, rating) || other.rating == rating)&&(identical(other.publicText, publicText) || other.publicText == publicText)&&(identical(other.expertReply, expertReply) || other.expertReply == expertReply)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,rating,publicText,expertReply,createdAt);

@override
String toString() {
  return 'ReviewItem(rating: $rating, publicText: $publicText, expertReply: $expertReply, createdAt: $createdAt)';
}


}

/// @nodoc
abstract mixin class _$ReviewItemCopyWith<$Res> implements $ReviewItemCopyWith<$Res> {
  factory _$ReviewItemCopyWith(_ReviewItem value, $Res Function(_ReviewItem) _then) = __$ReviewItemCopyWithImpl;
@override @useResult
$Res call({
 int rating, String? publicText, String? expertReply, DateTime createdAt
});




}
/// @nodoc
class __$ReviewItemCopyWithImpl<$Res>
    implements _$ReviewItemCopyWith<$Res> {
  __$ReviewItemCopyWithImpl(this._self, this._then);

  final _ReviewItem _self;
  final $Res Function(_ReviewItem) _then;

/// Create a copy of ReviewItem
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? rating = null,Object? publicText = freezed,Object? expertReply = freezed,Object? createdAt = null,}) {
  return _then(_ReviewItem(
rating: null == rating ? _self.rating : rating // ignore: cast_nullable_to_non_nullable
as int,publicText: freezed == publicText ? _self.publicText : publicText // ignore: cast_nullable_to_non_nullable
as String?,expertReply: freezed == expertReply ? _self.expertReply : expertReply // ignore: cast_nullable_to_non_nullable
as String?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,
  ));
}


}


/// @nodoc
mixin _$RatingDistribution {

@JsonKey(name: '1') int get rating1;@JsonKey(name: '2') int get rating2;@JsonKey(name: '3') int get rating3;@JsonKey(name: '4') int get rating4;@JsonKey(name: '5') int get rating5;
/// Create a copy of RatingDistribution
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$RatingDistributionCopyWith<RatingDistribution> get copyWith => _$RatingDistributionCopyWithImpl<RatingDistribution>(this as RatingDistribution, _$identity);

  /// Serializes this RatingDistribution to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is RatingDistribution&&(identical(other.rating1, rating1) || other.rating1 == rating1)&&(identical(other.rating2, rating2) || other.rating2 == rating2)&&(identical(other.rating3, rating3) || other.rating3 == rating3)&&(identical(other.rating4, rating4) || other.rating4 == rating4)&&(identical(other.rating5, rating5) || other.rating5 == rating5));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,rating1,rating2,rating3,rating4,rating5);

@override
String toString() {
  return 'RatingDistribution(rating1: $rating1, rating2: $rating2, rating3: $rating3, rating4: $rating4, rating5: $rating5)';
}


}

/// @nodoc
abstract mixin class $RatingDistributionCopyWith<$Res>  {
  factory $RatingDistributionCopyWith(RatingDistribution value, $Res Function(RatingDistribution) _then) = _$RatingDistributionCopyWithImpl;
@useResult
$Res call({
@JsonKey(name: '1') int rating1,@JsonKey(name: '2') int rating2,@JsonKey(name: '3') int rating3,@JsonKey(name: '4') int rating4,@JsonKey(name: '5') int rating5
});




}
/// @nodoc
class _$RatingDistributionCopyWithImpl<$Res>
    implements $RatingDistributionCopyWith<$Res> {
  _$RatingDistributionCopyWithImpl(this._self, this._then);

  final RatingDistribution _self;
  final $Res Function(RatingDistribution) _then;

/// Create a copy of RatingDistribution
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? rating1 = null,Object? rating2 = null,Object? rating3 = null,Object? rating4 = null,Object? rating5 = null,}) {
  return _then(RatingDistribution(
rating1: null == rating1 ? _self.rating1 : rating1 // ignore: cast_nullable_to_non_nullable
as int,rating2: null == rating2 ? _self.rating2 : rating2 // ignore: cast_nullable_to_non_nullable
as int,rating3: null == rating3 ? _self.rating3 : rating3 // ignore: cast_nullable_to_non_nullable
as int,rating4: null == rating4 ? _self.rating4 : rating4 // ignore: cast_nullable_to_non_nullable
as int,rating5: null == rating5 ? _self.rating5 : rating5 // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [RatingDistribution].
extension RatingDistributionPatterns on RatingDistribution {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _RatingDistribution value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _RatingDistribution() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _RatingDistribution value)  $default,){
final _that = this;
switch (_that) {
case _RatingDistribution():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _RatingDistribution value)?  $default,){
final _that = this;
switch (_that) {
case _RatingDistribution() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function(@JsonKey(name: '1')  int rating1, @JsonKey(name: '2')  int rating2, @JsonKey(name: '3')  int rating3, @JsonKey(name: '4')  int rating4, @JsonKey(name: '5')  int rating5)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _RatingDistribution() when $default != null:
return $default(_that.rating1,_that.rating2,_that.rating3,_that.rating4,_that.rating5);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function(@JsonKey(name: '1')  int rating1, @JsonKey(name: '2')  int rating2, @JsonKey(name: '3')  int rating3, @JsonKey(name: '4')  int rating4, @JsonKey(name: '5')  int rating5)  $default,) {final _that = this;
switch (_that) {
case _RatingDistribution():
return $default(_that.rating1,_that.rating2,_that.rating3,_that.rating4,_that.rating5);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function(@JsonKey(name: '1')  int rating1, @JsonKey(name: '2')  int rating2, @JsonKey(name: '3')  int rating3, @JsonKey(name: '4')  int rating4, @JsonKey(name: '5')  int rating5)?  $default,) {final _that = this;
switch (_that) {
case _RatingDistribution() when $default != null:
return $default(_that.rating1,_that.rating2,_that.rating3,_that.rating4,_that.rating5);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _RatingDistribution implements RatingDistribution {
  const _RatingDistribution({@JsonKey(name: '1') required this.rating1, @JsonKey(name: '2') required this.rating2, @JsonKey(name: '3') required this.rating3, @JsonKey(name: '4') required this.rating4, @JsonKey(name: '5') required this.rating5});
  factory _RatingDistribution.fromJson(Map<String, dynamic> json) => _$RatingDistributionFromJson(json);

@override@JsonKey(name: '1') final  int rating1;
@override@JsonKey(name: '2') final  int rating2;
@override@JsonKey(name: '3') final  int rating3;
@override@JsonKey(name: '4') final  int rating4;
@override@JsonKey(name: '5') final  int rating5;

/// Create a copy of RatingDistribution
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$RatingDistributionCopyWith<_RatingDistribution> get copyWith => __$RatingDistributionCopyWithImpl<_RatingDistribution>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$RatingDistributionToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _RatingDistribution&&(identical(other.rating1, rating1) || other.rating1 == rating1)&&(identical(other.rating2, rating2) || other.rating2 == rating2)&&(identical(other.rating3, rating3) || other.rating3 == rating3)&&(identical(other.rating4, rating4) || other.rating4 == rating4)&&(identical(other.rating5, rating5) || other.rating5 == rating5));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,rating1,rating2,rating3,rating4,rating5);

@override
String toString() {
  return 'RatingDistribution(rating1: $rating1, rating2: $rating2, rating3: $rating3, rating4: $rating4, rating5: $rating5)';
}


}

/// @nodoc
abstract mixin class _$RatingDistributionCopyWith<$Res> implements $RatingDistributionCopyWith<$Res> {
  factory _$RatingDistributionCopyWith(_RatingDistribution value, $Res Function(_RatingDistribution) _then) = __$RatingDistributionCopyWithImpl;
@override @useResult
$Res call({
@JsonKey(name: '1') int rating1,@JsonKey(name: '2') int rating2,@JsonKey(name: '3') int rating3,@JsonKey(name: '4') int rating4,@JsonKey(name: '5') int rating5
});




}
/// @nodoc
class __$RatingDistributionCopyWithImpl<$Res>
    implements _$RatingDistributionCopyWith<$Res> {
  __$RatingDistributionCopyWithImpl(this._self, this._then);

  final _RatingDistribution _self;
  final $Res Function(_RatingDistribution) _then;

/// Create a copy of RatingDistribution
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? rating1 = null,Object? rating2 = null,Object? rating3 = null,Object? rating4 = null,Object? rating5 = null,}) {
  return _then(_RatingDistribution(
rating1: null == rating1 ? _self.rating1 : rating1 // ignore: cast_nullable_to_non_nullable
as int,rating2: null == rating2 ? _self.rating2 : rating2 // ignore: cast_nullable_to_non_nullable
as int,rating3: null == rating3 ? _self.rating3 : rating3 // ignore: cast_nullable_to_non_nullable
as int,rating4: null == rating4 ? _self.rating4 : rating4 // ignore: cast_nullable_to_non_nullable
as int,rating5: null == rating5 ? _self.rating5 : rating5 // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}


/// @nodoc
mixin _$ExpertReviews {

 List<ReviewItem> get items; RatingDistribution get distribution; double get ratingAvg; int get ratingCount;
/// Create a copy of ExpertReviews
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ExpertReviewsCopyWith<ExpertReviews> get copyWith => _$ExpertReviewsCopyWithImpl<ExpertReviews>(this as ExpertReviews, _$identity);

  /// Serializes this ExpertReviews to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ExpertReviews&&const DeepCollectionEquality().equals(other.items, items)&&(identical(other.distribution, distribution) || other.distribution == distribution)&&(identical(other.ratingAvg, ratingAvg) || other.ratingAvg == ratingAvg)&&(identical(other.ratingCount, ratingCount) || other.ratingCount == ratingCount));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(items),distribution,ratingAvg,ratingCount);

@override
String toString() {
  return 'ExpertReviews(items: $items, distribution: $distribution, ratingAvg: $ratingAvg, ratingCount: $ratingCount)';
}


}

/// @nodoc
abstract mixin class $ExpertReviewsCopyWith<$Res>  {
  factory $ExpertReviewsCopyWith(ExpertReviews value, $Res Function(ExpertReviews) _then) = _$ExpertReviewsCopyWithImpl;
@useResult
$Res call({
 List<ReviewItem> items, RatingDistribution distribution, double ratingAvg, int ratingCount
});


$RatingDistributionCopyWith<$Res> get distribution;

}
/// @nodoc
class _$ExpertReviewsCopyWithImpl<$Res>
    implements $ExpertReviewsCopyWith<$Res> {
  _$ExpertReviewsCopyWithImpl(this._self, this._then);

  final ExpertReviews _self;
  final $Res Function(ExpertReviews) _then;

/// Create a copy of ExpertReviews
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? items = null,Object? distribution = null,Object? ratingAvg = null,Object? ratingCount = null,}) {
  return _then(ExpertReviews(
items: null == items ? _self.items : items // ignore: cast_nullable_to_non_nullable
as List<ReviewItem>,distribution: null == distribution ? _self.distribution : distribution // ignore: cast_nullable_to_non_nullable
as RatingDistribution,ratingAvg: null == ratingAvg ? _self.ratingAvg : ratingAvg // ignore: cast_nullable_to_non_nullable
as double,ratingCount: null == ratingCount ? _self.ratingCount : ratingCount // ignore: cast_nullable_to_non_nullable
as int,
  ));
}
/// Create a copy of ExpertReviews
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$RatingDistributionCopyWith<$Res> get distribution {
  
  return $RatingDistributionCopyWith<$Res>(_self.distribution, (value) {
    return _then(_self.copyWith(distribution: value));
  });
}
}


/// Adds pattern-matching-related methods to [ExpertReviews].
extension ExpertReviewsPatterns on ExpertReviews {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ExpertReviews value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ExpertReviews() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ExpertReviews value)  $default,){
final _that = this;
switch (_that) {
case _ExpertReviews():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ExpertReviews value)?  $default,){
final _that = this;
switch (_that) {
case _ExpertReviews() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<ReviewItem> items,  RatingDistribution distribution,  double ratingAvg,  int ratingCount)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ExpertReviews() when $default != null:
return $default(_that.items,_that.distribution,_that.ratingAvg,_that.ratingCount);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<ReviewItem> items,  RatingDistribution distribution,  double ratingAvg,  int ratingCount)  $default,) {final _that = this;
switch (_that) {
case _ExpertReviews():
return $default(_that.items,_that.distribution,_that.ratingAvg,_that.ratingCount);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<ReviewItem> items,  RatingDistribution distribution,  double ratingAvg,  int ratingCount)?  $default,) {final _that = this;
switch (_that) {
case _ExpertReviews() when $default != null:
return $default(_that.items,_that.distribution,_that.ratingAvg,_that.ratingCount);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ExpertReviews implements ExpertReviews {
  const _ExpertReviews({required  List<ReviewItem> items, required this.distribution, required this.ratingAvg, required this.ratingCount}): _items = items;
  factory _ExpertReviews.fromJson(Map<String, dynamic> json) => _$ExpertReviewsFromJson(json);

 final  List<ReviewItem> _items;
@override List<ReviewItem> get items {
  if (_items is EqualUnmodifiableListView) return _items;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_items);
}

@override final  RatingDistribution distribution;
@override final  double ratingAvg;
@override final  int ratingCount;

/// Create a copy of ExpertReviews
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ExpertReviewsCopyWith<_ExpertReviews> get copyWith => __$ExpertReviewsCopyWithImpl<_ExpertReviews>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ExpertReviewsToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ExpertReviews&&const DeepCollectionEquality().equals(other._items, _items)&&(identical(other.distribution, distribution) || other.distribution == distribution)&&(identical(other.ratingAvg, ratingAvg) || other.ratingAvg == ratingAvg)&&(identical(other.ratingCount, ratingCount) || other.ratingCount == ratingCount));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,const DeepCollectionEquality().hash(_items),distribution,ratingAvg,ratingCount);

@override
String toString() {
  return 'ExpertReviews(items: $items, distribution: $distribution, ratingAvg: $ratingAvg, ratingCount: $ratingCount)';
}


}

/// @nodoc
abstract mixin class _$ExpertReviewsCopyWith<$Res> implements $ExpertReviewsCopyWith<$Res> {
  factory _$ExpertReviewsCopyWith(_ExpertReviews value, $Res Function(_ExpertReviews) _then) = __$ExpertReviewsCopyWithImpl;
@override @useResult
$Res call({
 List<ReviewItem> items, RatingDistribution distribution, double ratingAvg, int ratingCount
});


@override $RatingDistributionCopyWith<$Res> get distribution;

}
/// @nodoc
class __$ExpertReviewsCopyWithImpl<$Res>
    implements _$ExpertReviewsCopyWith<$Res> {
  __$ExpertReviewsCopyWithImpl(this._self, this._then);

  final _ExpertReviews _self;
  final $Res Function(_ExpertReviews) _then;

/// Create a copy of ExpertReviews
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? items = null,Object? distribution = null,Object? ratingAvg = null,Object? ratingCount = null,}) {
  return _then(_ExpertReviews(
items: null == items ? _self._items : items // ignore: cast_nullable_to_non_nullable
as List<ReviewItem>,distribution: null == distribution ? _self.distribution : distribution // ignore: cast_nullable_to_non_nullable
as RatingDistribution,ratingAvg: null == ratingAvg ? _self.ratingAvg : ratingAvg // ignore: cast_nullable_to_non_nullable
as double,ratingCount: null == ratingCount ? _self.ratingCount : ratingCount // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

/// Create a copy of ExpertReviews
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$RatingDistributionCopyWith<$Res> get distribution {
  
  return $RatingDistributionCopyWith<$Res>(_self.distribution, (value) {
    return _then(_self.copyWith(distribution: value));
  });
}
}

// dart format on
