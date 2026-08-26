// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'content_item.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$BreathingPhase {

 String get name; int get seconds;
/// Create a copy of BreathingPhase
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$BreathingPhaseCopyWith<BreathingPhase> get copyWith => _$BreathingPhaseCopyWithImpl<BreathingPhase>(this as BreathingPhase, _$identity);

  /// Serializes this BreathingPhase to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is BreathingPhase&&(identical(other.name, name) || other.name == name)&&(identical(other.seconds, seconds) || other.seconds == seconds));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,name,seconds);

@override
String toString() {
  return 'BreathingPhase(name: $name, seconds: $seconds)';
}


}

/// @nodoc
abstract mixin class $BreathingPhaseCopyWith<$Res>  {
  factory $BreathingPhaseCopyWith(BreathingPhase value, $Res Function(BreathingPhase) _then) = _$BreathingPhaseCopyWithImpl;
@useResult
$Res call({
 String name, int seconds
});




}
/// @nodoc
class _$BreathingPhaseCopyWithImpl<$Res>
    implements $BreathingPhaseCopyWith<$Res> {
  _$BreathingPhaseCopyWithImpl(this._self, this._then);

  final BreathingPhase _self;
  final $Res Function(BreathingPhase) _then;

/// Create a copy of BreathingPhase
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? name = null,Object? seconds = null,}) {
  return _then(BreathingPhase(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,seconds: null == seconds ? _self.seconds : seconds // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [BreathingPhase].
extension BreathingPhasePatterns on BreathingPhase {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _BreathingPhase value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _BreathingPhase() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _BreathingPhase value)  $default,){
final _that = this;
switch (_that) {
case _BreathingPhase():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _BreathingPhase value)?  $default,){
final _that = this;
switch (_that) {
case _BreathingPhase() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String name,  int seconds)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _BreathingPhase() when $default != null:
return $default(_that.name,_that.seconds);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String name,  int seconds)  $default,) {final _that = this;
switch (_that) {
case _BreathingPhase():
return $default(_that.name,_that.seconds);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String name,  int seconds)?  $default,) {final _that = this;
switch (_that) {
case _BreathingPhase() when $default != null:
return $default(_that.name,_that.seconds);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _BreathingPhase implements BreathingPhase {
  const _BreathingPhase({required this.name, required this.seconds});
  factory _BreathingPhase.fromJson(Map<String, dynamic> json) => _$BreathingPhaseFromJson(json);

@override final  String name;
@override final  int seconds;

/// Create a copy of BreathingPhase
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$BreathingPhaseCopyWith<_BreathingPhase> get copyWith => __$BreathingPhaseCopyWithImpl<_BreathingPhase>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$BreathingPhaseToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _BreathingPhase&&(identical(other.name, name) || other.name == name)&&(identical(other.seconds, seconds) || other.seconds == seconds));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,name,seconds);

@override
String toString() {
  return 'BreathingPhase(name: $name, seconds: $seconds)';
}


}

/// @nodoc
abstract mixin class _$BreathingPhaseCopyWith<$Res> implements $BreathingPhaseCopyWith<$Res> {
  factory _$BreathingPhaseCopyWith(_BreathingPhase value, $Res Function(_BreathingPhase) _then) = __$BreathingPhaseCopyWithImpl;
@override @useResult
$Res call({
 String name, int seconds
});




}
/// @nodoc
class __$BreathingPhaseCopyWithImpl<$Res>
    implements _$BreathingPhaseCopyWith<$Res> {
  __$BreathingPhaseCopyWithImpl(this._self, this._then);

  final _BreathingPhase _self;
  final $Res Function(_BreathingPhase) _then;

/// Create a copy of BreathingPhase
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? name = null,Object? seconds = null,}) {
  return _then(_BreathingPhase(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,seconds: null == seconds ? _self.seconds : seconds // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}


/// @nodoc
mixin _$ContentItem {

 String get id; ContentKind get kind; ContentAccess get access; String get slug; String get category; String get title; String get summary;/// Материал за подпиской, а подписки нет. Решение о доступе принимает
/// сервер при выдаче ссылки — это флаг для замка на карточке, не
/// проверка прав.
 bool get locked; int get positionPermille; int? get durationSec; String? get coverUrl; int? get usefulYes; int? get usefulNo;@JsonKey(includeFromJson: false, includeToJson: false) ContentBody? get body;
/// Create a copy of ContentItem
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ContentItemCopyWith<ContentItem> get copyWith => _$ContentItemCopyWithImpl<ContentItem>(this as ContentItem, _$identity);

  /// Serializes this ContentItem to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ContentItem&&(identical(other.id, id) || other.id == id)&&(identical(other.kind, kind) || other.kind == kind)&&(identical(other.access, access) || other.access == access)&&(identical(other.slug, slug) || other.slug == slug)&&(identical(other.category, category) || other.category == category)&&(identical(other.title, title) || other.title == title)&&(identical(other.summary, summary) || other.summary == summary)&&(identical(other.locked, locked) || other.locked == locked)&&(identical(other.positionPermille, positionPermille) || other.positionPermille == positionPermille)&&(identical(other.durationSec, durationSec) || other.durationSec == durationSec)&&(identical(other.coverUrl, coverUrl) || other.coverUrl == coverUrl)&&(identical(other.usefulYes, usefulYes) || other.usefulYes == usefulYes)&&(identical(other.usefulNo, usefulNo) || other.usefulNo == usefulNo)&&(identical(other.body, body) || other.body == body));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,kind,access,slug,category,title,summary,locked,positionPermille,durationSec,coverUrl,usefulYes,usefulNo,body);

@override
String toString() {
  return 'ContentItem(id: $id, kind: $kind, access: $access, slug: $slug, category: $category, title: $title, summary: $summary, locked: $locked, positionPermille: $positionPermille, durationSec: $durationSec, coverUrl: $coverUrl, usefulYes: $usefulYes, usefulNo: $usefulNo, body: $body)';
}


}

/// @nodoc
abstract mixin class $ContentItemCopyWith<$Res>  {
  factory $ContentItemCopyWith(ContentItem value, $Res Function(ContentItem) _then) = _$ContentItemCopyWithImpl;
@useResult
$Res call({
 String id, ContentKind kind, ContentAccess access, String slug, String category, String title, String summary, bool locked, int positionPermille, int? durationSec, String? coverUrl, int? usefulYes, int? usefulNo,@JsonKey(includeFromJson: false, includeToJson: false) ContentBody? body
});




}
/// @nodoc
class _$ContentItemCopyWithImpl<$Res>
    implements $ContentItemCopyWith<$Res> {
  _$ContentItemCopyWithImpl(this._self, this._then);

  final ContentItem _self;
  final $Res Function(ContentItem) _then;

/// Create a copy of ContentItem
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? kind = null,Object? access = null,Object? slug = null,Object? category = null,Object? title = null,Object? summary = null,Object? locked = null,Object? positionPermille = null,Object? durationSec = freezed,Object? coverUrl = freezed,Object? usefulYes = freezed,Object? usefulNo = freezed,Object? body = freezed,}) {
  return _then(ContentItem(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,kind: null == kind ? _self.kind : kind // ignore: cast_nullable_to_non_nullable
as ContentKind,access: null == access ? _self.access : access // ignore: cast_nullable_to_non_nullable
as ContentAccess,slug: null == slug ? _self.slug : slug // ignore: cast_nullable_to_non_nullable
as String,category: null == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,summary: null == summary ? _self.summary : summary // ignore: cast_nullable_to_non_nullable
as String,locked: null == locked ? _self.locked : locked // ignore: cast_nullable_to_non_nullable
as bool,positionPermille: null == positionPermille ? _self.positionPermille : positionPermille // ignore: cast_nullable_to_non_nullable
as int,durationSec: freezed == durationSec ? _self.durationSec : durationSec // ignore: cast_nullable_to_non_nullable
as int?,coverUrl: freezed == coverUrl ? _self.coverUrl : coverUrl // ignore: cast_nullable_to_non_nullable
as String?,usefulYes: freezed == usefulYes ? _self.usefulYes : usefulYes // ignore: cast_nullable_to_non_nullable
as int?,usefulNo: freezed == usefulNo ? _self.usefulNo : usefulNo // ignore: cast_nullable_to_non_nullable
as int?,body: freezed == body ? _self.body : body // ignore: cast_nullable_to_non_nullable
as ContentBody?,
  ));
}

}


/// Adds pattern-matching-related methods to [ContentItem].
extension ContentItemPatterns on ContentItem {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ContentItem value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ContentItem() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ContentItem value)  $default,){
final _that = this;
switch (_that) {
case _ContentItem():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ContentItem value)?  $default,){
final _that = this;
switch (_that) {
case _ContentItem() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  ContentKind kind,  ContentAccess access,  String slug,  String category,  String title,  String summary,  bool locked,  int positionPermille,  int? durationSec,  String? coverUrl,  int? usefulYes,  int? usefulNo, @JsonKey(includeFromJson: false, includeToJson: false)  ContentBody? body)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ContentItem() when $default != null:
return $default(_that.id,_that.kind,_that.access,_that.slug,_that.category,_that.title,_that.summary,_that.locked,_that.positionPermille,_that.durationSec,_that.coverUrl,_that.usefulYes,_that.usefulNo,_that.body);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  ContentKind kind,  ContentAccess access,  String slug,  String category,  String title,  String summary,  bool locked,  int positionPermille,  int? durationSec,  String? coverUrl,  int? usefulYes,  int? usefulNo, @JsonKey(includeFromJson: false, includeToJson: false)  ContentBody? body)  $default,) {final _that = this;
switch (_that) {
case _ContentItem():
return $default(_that.id,_that.kind,_that.access,_that.slug,_that.category,_that.title,_that.summary,_that.locked,_that.positionPermille,_that.durationSec,_that.coverUrl,_that.usefulYes,_that.usefulNo,_that.body);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  ContentKind kind,  ContentAccess access,  String slug,  String category,  String title,  String summary,  bool locked,  int positionPermille,  int? durationSec,  String? coverUrl,  int? usefulYes,  int? usefulNo, @JsonKey(includeFromJson: false, includeToJson: false)  ContentBody? body)?  $default,) {final _that = this;
switch (_that) {
case _ContentItem() when $default != null:
return $default(_that.id,_that.kind,_that.access,_that.slug,_that.category,_that.title,_that.summary,_that.locked,_that.positionPermille,_that.durationSec,_that.coverUrl,_that.usefulYes,_that.usefulNo,_that.body);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ContentItem extends ContentItem {
  const _ContentItem({required this.id, required this.kind, required this.access, required this.slug, required this.category, required this.title, required this.summary, this.locked = false, this.positionPermille = 0, this.durationSec, this.coverUrl, this.usefulYes, this.usefulNo, @JsonKey(includeFromJson: false, includeToJson: false) this.body}): super._();
  factory _ContentItem.fromJson(Map<String, dynamic> json) => _$ContentItemFromJson(json);

@override final  String id;
@override final  ContentKind kind;
@override final  ContentAccess access;
@override final  String slug;
@override final  String category;
@override final  String title;
@override final  String summary;
/// Материал за подпиской, а подписки нет. Решение о доступе принимает
/// сервер при выдаче ссылки — это флаг для замка на карточке, не
/// проверка прав.
@override@JsonKey() final  bool locked;
@override@JsonKey() final  int positionPermille;
@override final  int? durationSec;
@override final  String? coverUrl;
@override final  int? usefulYes;
@override final  int? usefulNo;
@override@JsonKey(includeFromJson: false, includeToJson: false) final  ContentBody? body;

/// Create a copy of ContentItem
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ContentItemCopyWith<_ContentItem> get copyWith => __$ContentItemCopyWithImpl<_ContentItem>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ContentItemToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ContentItem&&(identical(other.id, id) || other.id == id)&&(identical(other.kind, kind) || other.kind == kind)&&(identical(other.access, access) || other.access == access)&&(identical(other.slug, slug) || other.slug == slug)&&(identical(other.category, category) || other.category == category)&&(identical(other.title, title) || other.title == title)&&(identical(other.summary, summary) || other.summary == summary)&&(identical(other.locked, locked) || other.locked == locked)&&(identical(other.positionPermille, positionPermille) || other.positionPermille == positionPermille)&&(identical(other.durationSec, durationSec) || other.durationSec == durationSec)&&(identical(other.coverUrl, coverUrl) || other.coverUrl == coverUrl)&&(identical(other.usefulYes, usefulYes) || other.usefulYes == usefulYes)&&(identical(other.usefulNo, usefulNo) || other.usefulNo == usefulNo)&&(identical(other.body, body) || other.body == body));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,kind,access,slug,category,title,summary,locked,positionPermille,durationSec,coverUrl,usefulYes,usefulNo,body);

@override
String toString() {
  return 'ContentItem(id: $id, kind: $kind, access: $access, slug: $slug, category: $category, title: $title, summary: $summary, locked: $locked, positionPermille: $positionPermille, durationSec: $durationSec, coverUrl: $coverUrl, usefulYes: $usefulYes, usefulNo: $usefulNo, body: $body)';
}


}

/// @nodoc
abstract mixin class _$ContentItemCopyWith<$Res> implements $ContentItemCopyWith<$Res> {
  factory _$ContentItemCopyWith(_ContentItem value, $Res Function(_ContentItem) _then) = __$ContentItemCopyWithImpl;
@override @useResult
$Res call({
 String id, ContentKind kind, ContentAccess access, String slug, String category, String title, String summary, bool locked, int positionPermille, int? durationSec, String? coverUrl, int? usefulYes, int? usefulNo,@JsonKey(includeFromJson: false, includeToJson: false) ContentBody? body
});




}
/// @nodoc
class __$ContentItemCopyWithImpl<$Res>
    implements _$ContentItemCopyWith<$Res> {
  __$ContentItemCopyWithImpl(this._self, this._then);

  final _ContentItem _self;
  final $Res Function(_ContentItem) _then;

/// Create a copy of ContentItem
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? kind = null,Object? access = null,Object? slug = null,Object? category = null,Object? title = null,Object? summary = null,Object? locked = null,Object? positionPermille = null,Object? durationSec = freezed,Object? coverUrl = freezed,Object? usefulYes = freezed,Object? usefulNo = freezed,Object? body = freezed,}) {
  return _then(_ContentItem(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,kind: null == kind ? _self.kind : kind // ignore: cast_nullable_to_non_nullable
as ContentKind,access: null == access ? _self.access : access // ignore: cast_nullable_to_non_nullable
as ContentAccess,slug: null == slug ? _self.slug : slug // ignore: cast_nullable_to_non_nullable
as String,category: null == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,summary: null == summary ? _self.summary : summary // ignore: cast_nullable_to_non_nullable
as String,locked: null == locked ? _self.locked : locked // ignore: cast_nullable_to_non_nullable
as bool,positionPermille: null == positionPermille ? _self.positionPermille : positionPermille // ignore: cast_nullable_to_non_nullable
as int,durationSec: freezed == durationSec ? _self.durationSec : durationSec // ignore: cast_nullable_to_non_nullable
as int?,coverUrl: freezed == coverUrl ? _self.coverUrl : coverUrl // ignore: cast_nullable_to_non_nullable
as String?,usefulYes: freezed == usefulYes ? _self.usefulYes : usefulYes // ignore: cast_nullable_to_non_nullable
as int?,usefulNo: freezed == usefulNo ? _self.usefulNo : usefulNo // ignore: cast_nullable_to_non_nullable
as int?,body: freezed == body ? _self.body : body // ignore: cast_nullable_to_non_nullable
as ContentBody?,
  ));
}


}


/// @nodoc
mixin _$ContentMedia {

 String get url; DateTime get expiresAt;
/// Create a copy of ContentMedia
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ContentMediaCopyWith<ContentMedia> get copyWith => _$ContentMediaCopyWithImpl<ContentMedia>(this as ContentMedia, _$identity);

  /// Serializes this ContentMedia to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ContentMedia&&(identical(other.url, url) || other.url == url)&&(identical(other.expiresAt, expiresAt) || other.expiresAt == expiresAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,url,expiresAt);

@override
String toString() {
  return 'ContentMedia(url: $url, expiresAt: $expiresAt)';
}


}

/// @nodoc
abstract mixin class $ContentMediaCopyWith<$Res>  {
  factory $ContentMediaCopyWith(ContentMedia value, $Res Function(ContentMedia) _then) = _$ContentMediaCopyWithImpl;
@useResult
$Res call({
 String url, DateTime expiresAt
});




}
/// @nodoc
class _$ContentMediaCopyWithImpl<$Res>
    implements $ContentMediaCopyWith<$Res> {
  _$ContentMediaCopyWithImpl(this._self, this._then);

  final ContentMedia _self;
  final $Res Function(ContentMedia) _then;

/// Create a copy of ContentMedia
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? url = null,Object? expiresAt = null,}) {
  return _then(ContentMedia(
url: null == url ? _self.url : url // ignore: cast_nullable_to_non_nullable
as String,expiresAt: null == expiresAt ? _self.expiresAt : expiresAt // ignore: cast_nullable_to_non_nullable
as DateTime,
  ));
}

}


/// Adds pattern-matching-related methods to [ContentMedia].
extension ContentMediaPatterns on ContentMedia {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ContentMedia value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ContentMedia() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ContentMedia value)  $default,){
final _that = this;
switch (_that) {
case _ContentMedia():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ContentMedia value)?  $default,){
final _that = this;
switch (_that) {
case _ContentMedia() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String url,  DateTime expiresAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ContentMedia() when $default != null:
return $default(_that.url,_that.expiresAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String url,  DateTime expiresAt)  $default,) {final _that = this;
switch (_that) {
case _ContentMedia():
return $default(_that.url,_that.expiresAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String url,  DateTime expiresAt)?  $default,) {final _that = this;
switch (_that) {
case _ContentMedia() when $default != null:
return $default(_that.url,_that.expiresAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ContentMedia implements ContentMedia {
  const _ContentMedia({required this.url, required this.expiresAt});
  factory _ContentMedia.fromJson(Map<String, dynamic> json) => _$ContentMediaFromJson(json);

@override final  String url;
@override final  DateTime expiresAt;

/// Create a copy of ContentMedia
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ContentMediaCopyWith<_ContentMedia> get copyWith => __$ContentMediaCopyWithImpl<_ContentMedia>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ContentMediaToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ContentMedia&&(identical(other.url, url) || other.url == url)&&(identical(other.expiresAt, expiresAt) || other.expiresAt == expiresAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,url,expiresAt);

@override
String toString() {
  return 'ContentMedia(url: $url, expiresAt: $expiresAt)';
}


}

/// @nodoc
abstract mixin class _$ContentMediaCopyWith<$Res> implements $ContentMediaCopyWith<$Res> {
  factory _$ContentMediaCopyWith(_ContentMedia value, $Res Function(_ContentMedia) _then) = __$ContentMediaCopyWithImpl;
@override @useResult
$Res call({
 String url, DateTime expiresAt
});




}
/// @nodoc
class __$ContentMediaCopyWithImpl<$Res>
    implements _$ContentMediaCopyWith<$Res> {
  __$ContentMediaCopyWithImpl(this._self, this._then);

  final _ContentMedia _self;
  final $Res Function(_ContentMedia) _then;

/// Create a copy of ContentMedia
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? url = null,Object? expiresAt = null,}) {
  return _then(_ContentMedia(
url: null == url ? _self.url : url // ignore: cast_nullable_to_non_nullable
as String,expiresAt: null == expiresAt ? _self.expiresAt : expiresAt // ignore: cast_nullable_to_non_nullable
as DateTime,
  ));
}


}


/// @nodoc
mixin _$ContentProgress {

 int get positionPermille; bool get completed;
/// Create a copy of ContentProgress
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ContentProgressCopyWith<ContentProgress> get copyWith => _$ContentProgressCopyWithImpl<ContentProgress>(this as ContentProgress, _$identity);

  /// Serializes this ContentProgress to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ContentProgress&&(identical(other.positionPermille, positionPermille) || other.positionPermille == positionPermille)&&(identical(other.completed, completed) || other.completed == completed));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,positionPermille,completed);

@override
String toString() {
  return 'ContentProgress(positionPermille: $positionPermille, completed: $completed)';
}


}

/// @nodoc
abstract mixin class $ContentProgressCopyWith<$Res>  {
  factory $ContentProgressCopyWith(ContentProgress value, $Res Function(ContentProgress) _then) = _$ContentProgressCopyWithImpl;
@useResult
$Res call({
 int positionPermille, bool completed
});




}
/// @nodoc
class _$ContentProgressCopyWithImpl<$Res>
    implements $ContentProgressCopyWith<$Res> {
  _$ContentProgressCopyWithImpl(this._self, this._then);

  final ContentProgress _self;
  final $Res Function(ContentProgress) _then;

/// Create a copy of ContentProgress
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? positionPermille = null,Object? completed = null,}) {
  return _then(ContentProgress(
positionPermille: null == positionPermille ? _self.positionPermille : positionPermille // ignore: cast_nullable_to_non_nullable
as int,completed: null == completed ? _self.completed : completed // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [ContentProgress].
extension ContentProgressPatterns on ContentProgress {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ContentProgress value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ContentProgress() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ContentProgress value)  $default,){
final _that = this;
switch (_that) {
case _ContentProgress():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ContentProgress value)?  $default,){
final _that = this;
switch (_that) {
case _ContentProgress() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int positionPermille,  bool completed)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ContentProgress() when $default != null:
return $default(_that.positionPermille,_that.completed);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int positionPermille,  bool completed)  $default,) {final _that = this;
switch (_that) {
case _ContentProgress():
return $default(_that.positionPermille,_that.completed);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int positionPermille,  bool completed)?  $default,) {final _that = this;
switch (_that) {
case _ContentProgress() when $default != null:
return $default(_that.positionPermille,_that.completed);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ContentProgress implements ContentProgress {
  const _ContentProgress({required this.positionPermille, required this.completed});
  factory _ContentProgress.fromJson(Map<String, dynamic> json) => _$ContentProgressFromJson(json);

@override final  int positionPermille;
@override final  bool completed;

/// Create a copy of ContentProgress
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ContentProgressCopyWith<_ContentProgress> get copyWith => __$ContentProgressCopyWithImpl<_ContentProgress>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ContentProgressToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ContentProgress&&(identical(other.positionPermille, positionPermille) || other.positionPermille == positionPermille)&&(identical(other.completed, completed) || other.completed == completed));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,positionPermille,completed);

@override
String toString() {
  return 'ContentProgress(positionPermille: $positionPermille, completed: $completed)';
}


}

/// @nodoc
abstract mixin class _$ContentProgressCopyWith<$Res> implements $ContentProgressCopyWith<$Res> {
  factory _$ContentProgressCopyWith(_ContentProgress value, $Res Function(_ContentProgress) _then) = __$ContentProgressCopyWithImpl;
@override @useResult
$Res call({
 int positionPermille, bool completed
});




}
/// @nodoc
class __$ContentProgressCopyWithImpl<$Res>
    implements _$ContentProgressCopyWith<$Res> {
  __$ContentProgressCopyWithImpl(this._self, this._then);

  final _ContentProgress _self;
  final $Res Function(_ContentProgress) _then;

/// Create a copy of ContentProgress
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? positionPermille = null,Object? completed = null,}) {
  return _then(_ContentProgress(
positionPermille: null == positionPermille ? _self.positionPermille : positionPermille // ignore: cast_nullable_to_non_nullable
as int,completed: null == completed ? _self.completed : completed // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}


/// @nodoc
mixin _$ContentVotes {

 int get usefulYes; int get usefulNo;
/// Create a copy of ContentVotes
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ContentVotesCopyWith<ContentVotes> get copyWith => _$ContentVotesCopyWithImpl<ContentVotes>(this as ContentVotes, _$identity);

  /// Serializes this ContentVotes to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ContentVotes&&(identical(other.usefulYes, usefulYes) || other.usefulYes == usefulYes)&&(identical(other.usefulNo, usefulNo) || other.usefulNo == usefulNo));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,usefulYes,usefulNo);

@override
String toString() {
  return 'ContentVotes(usefulYes: $usefulYes, usefulNo: $usefulNo)';
}


}

/// @nodoc
abstract mixin class $ContentVotesCopyWith<$Res>  {
  factory $ContentVotesCopyWith(ContentVotes value, $Res Function(ContentVotes) _then) = _$ContentVotesCopyWithImpl;
@useResult
$Res call({
 int usefulYes, int usefulNo
});




}
/// @nodoc
class _$ContentVotesCopyWithImpl<$Res>
    implements $ContentVotesCopyWith<$Res> {
  _$ContentVotesCopyWithImpl(this._self, this._then);

  final ContentVotes _self;
  final $Res Function(ContentVotes) _then;

/// Create a copy of ContentVotes
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? usefulYes = null,Object? usefulNo = null,}) {
  return _then(ContentVotes(
usefulYes: null == usefulYes ? _self.usefulYes : usefulYes // ignore: cast_nullable_to_non_nullable
as int,usefulNo: null == usefulNo ? _self.usefulNo : usefulNo // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [ContentVotes].
extension ContentVotesPatterns on ContentVotes {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ContentVotes value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ContentVotes() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ContentVotes value)  $default,){
final _that = this;
switch (_that) {
case _ContentVotes():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ContentVotes value)?  $default,){
final _that = this;
switch (_that) {
case _ContentVotes() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int usefulYes,  int usefulNo)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ContentVotes() when $default != null:
return $default(_that.usefulYes,_that.usefulNo);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int usefulYes,  int usefulNo)  $default,) {final _that = this;
switch (_that) {
case _ContentVotes():
return $default(_that.usefulYes,_that.usefulNo);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int usefulYes,  int usefulNo)?  $default,) {final _that = this;
switch (_that) {
case _ContentVotes() when $default != null:
return $default(_that.usefulYes,_that.usefulNo);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ContentVotes implements ContentVotes {
  const _ContentVotes({required this.usefulYes, required this.usefulNo});
  factory _ContentVotes.fromJson(Map<String, dynamic> json) => _$ContentVotesFromJson(json);

@override final  int usefulYes;
@override final  int usefulNo;

/// Create a copy of ContentVotes
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ContentVotesCopyWith<_ContentVotes> get copyWith => __$ContentVotesCopyWithImpl<_ContentVotes>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ContentVotesToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ContentVotes&&(identical(other.usefulYes, usefulYes) || other.usefulYes == usefulYes)&&(identical(other.usefulNo, usefulNo) || other.usefulNo == usefulNo));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,usefulYes,usefulNo);

@override
String toString() {
  return 'ContentVotes(usefulYes: $usefulYes, usefulNo: $usefulNo)';
}


}

/// @nodoc
abstract mixin class _$ContentVotesCopyWith<$Res> implements $ContentVotesCopyWith<$Res> {
  factory _$ContentVotesCopyWith(_ContentVotes value, $Res Function(_ContentVotes) _then) = __$ContentVotesCopyWithImpl;
@override @useResult
$Res call({
 int usefulYes, int usefulNo
});




}
/// @nodoc
class __$ContentVotesCopyWithImpl<$Res>
    implements _$ContentVotesCopyWith<$Res> {
  __$ContentVotesCopyWithImpl(this._self, this._then);

  final _ContentVotes _self;
  final $Res Function(_ContentVotes) _then;

/// Create a copy of ContentVotes
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? usefulYes = null,Object? usefulNo = null,}) {
  return _then(_ContentVotes(
usefulYes: null == usefulYes ? _self.usefulYes : usefulYes // ignore: cast_nullable_to_non_nullable
as int,usefulNo: null == usefulNo ? _self.usefulNo : usefulNo // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}


/// @nodoc
mixin _$ContentStreak {

 int get currentDays; int get longestDays; int get completedCount;
/// Create a copy of ContentStreak
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ContentStreakCopyWith<ContentStreak> get copyWith => _$ContentStreakCopyWithImpl<ContentStreak>(this as ContentStreak, _$identity);

  /// Serializes this ContentStreak to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ContentStreak&&(identical(other.currentDays, currentDays) || other.currentDays == currentDays)&&(identical(other.longestDays, longestDays) || other.longestDays == longestDays)&&(identical(other.completedCount, completedCount) || other.completedCount == completedCount));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,currentDays,longestDays,completedCount);

@override
String toString() {
  return 'ContentStreak(currentDays: $currentDays, longestDays: $longestDays, completedCount: $completedCount)';
}


}

/// @nodoc
abstract mixin class $ContentStreakCopyWith<$Res>  {
  factory $ContentStreakCopyWith(ContentStreak value, $Res Function(ContentStreak) _then) = _$ContentStreakCopyWithImpl;
@useResult
$Res call({
 int currentDays, int longestDays, int completedCount
});




}
/// @nodoc
class _$ContentStreakCopyWithImpl<$Res>
    implements $ContentStreakCopyWith<$Res> {
  _$ContentStreakCopyWithImpl(this._self, this._then);

  final ContentStreak _self;
  final $Res Function(ContentStreak) _then;

/// Create a copy of ContentStreak
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? currentDays = null,Object? longestDays = null,Object? completedCount = null,}) {
  return _then(ContentStreak(
currentDays: null == currentDays ? _self.currentDays : currentDays // ignore: cast_nullable_to_non_nullable
as int,longestDays: null == longestDays ? _self.longestDays : longestDays // ignore: cast_nullable_to_non_nullable
as int,completedCount: null == completedCount ? _self.completedCount : completedCount // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [ContentStreak].
extension ContentStreakPatterns on ContentStreak {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ContentStreak value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ContentStreak() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ContentStreak value)  $default,){
final _that = this;
switch (_that) {
case _ContentStreak():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ContentStreak value)?  $default,){
final _that = this;
switch (_that) {
case _ContentStreak() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int currentDays,  int longestDays,  int completedCount)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ContentStreak() when $default != null:
return $default(_that.currentDays,_that.longestDays,_that.completedCount);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int currentDays,  int longestDays,  int completedCount)  $default,) {final _that = this;
switch (_that) {
case _ContentStreak():
return $default(_that.currentDays,_that.longestDays,_that.completedCount);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int currentDays,  int longestDays,  int completedCount)?  $default,) {final _that = this;
switch (_that) {
case _ContentStreak() when $default != null:
return $default(_that.currentDays,_that.longestDays,_that.completedCount);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ContentStreak implements ContentStreak {
  const _ContentStreak({required this.currentDays, required this.longestDays, required this.completedCount});
  factory _ContentStreak.fromJson(Map<String, dynamic> json) => _$ContentStreakFromJson(json);

@override final  int currentDays;
@override final  int longestDays;
@override final  int completedCount;

/// Create a copy of ContentStreak
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ContentStreakCopyWith<_ContentStreak> get copyWith => __$ContentStreakCopyWithImpl<_ContentStreak>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ContentStreakToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ContentStreak&&(identical(other.currentDays, currentDays) || other.currentDays == currentDays)&&(identical(other.longestDays, longestDays) || other.longestDays == longestDays)&&(identical(other.completedCount, completedCount) || other.completedCount == completedCount));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,currentDays,longestDays,completedCount);

@override
String toString() {
  return 'ContentStreak(currentDays: $currentDays, longestDays: $longestDays, completedCount: $completedCount)';
}


}

/// @nodoc
abstract mixin class _$ContentStreakCopyWith<$Res> implements $ContentStreakCopyWith<$Res> {
  factory _$ContentStreakCopyWith(_ContentStreak value, $Res Function(_ContentStreak) _then) = __$ContentStreakCopyWithImpl;
@override @useResult
$Res call({
 int currentDays, int longestDays, int completedCount
});




}
/// @nodoc
class __$ContentStreakCopyWithImpl<$Res>
    implements _$ContentStreakCopyWith<$Res> {
  __$ContentStreakCopyWithImpl(this._self, this._then);

  final _ContentStreak _self;
  final $Res Function(_ContentStreak) _then;

/// Create a copy of ContentStreak
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? currentDays = null,Object? longestDays = null,Object? completedCount = null,}) {
  return _then(_ContentStreak(
currentDays: null == currentDays ? _self.currentDays : currentDays // ignore: cast_nullable_to_non_nullable
as int,longestDays: null == longestDays ? _self.longestDays : longestDays // ignore: cast_nullable_to_non_nullable
as int,completedCount: null == completedCount ? _self.completedCount : completedCount // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}

// dart format on
