// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'expert.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$ExpertPublic {

 String get id; String get displayName; String get city; ExperienceLevel get experience; int get priceTiyn; List<String> get languages; List<SessionFormat> get formats; List<String> get topicSlugs; WorkStatus get workStatus; double get ratingAvg; int get ratingCount;
/// Create a copy of ExpertPublic
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ExpertPublicCopyWith<ExpertPublic> get copyWith => _$ExpertPublicCopyWithImpl<ExpertPublic>(this as ExpertPublic, _$identity);

  /// Serializes this ExpertPublic to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ExpertPublic&&(identical(other.id, id) || other.id == id)&&(identical(other.displayName, displayName) || other.displayName == displayName)&&(identical(other.city, city) || other.city == city)&&(identical(other.experience, experience) || other.experience == experience)&&(identical(other.priceTiyn, priceTiyn) || other.priceTiyn == priceTiyn)&&const DeepCollectionEquality().equals(other.languages, languages)&&const DeepCollectionEquality().equals(other.formats, formats)&&const DeepCollectionEquality().equals(other.topicSlugs, topicSlugs)&&(identical(other.workStatus, workStatus) || other.workStatus == workStatus)&&(identical(other.ratingAvg, ratingAvg) || other.ratingAvg == ratingAvg)&&(identical(other.ratingCount, ratingCount) || other.ratingCount == ratingCount));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,displayName,city,experience,priceTiyn,const DeepCollectionEquality().hash(languages),const DeepCollectionEquality().hash(formats),const DeepCollectionEquality().hash(topicSlugs),workStatus,ratingAvg,ratingCount);

@override
String toString() {
  return 'ExpertPublic(id: $id, displayName: $displayName, city: $city, experience: $experience, priceTiyn: $priceTiyn, languages: $languages, formats: $formats, topicSlugs: $topicSlugs, workStatus: $workStatus, ratingAvg: $ratingAvg, ratingCount: $ratingCount)';
}


}

/// @nodoc
abstract mixin class $ExpertPublicCopyWith<$Res>  {
  factory $ExpertPublicCopyWith(ExpertPublic value, $Res Function(ExpertPublic) _then) = _$ExpertPublicCopyWithImpl;
@useResult
$Res call({
 String id, String displayName, String city, ExperienceLevel experience, int priceTiyn, List<String> languages, List<SessionFormat> formats, List<String> topicSlugs, WorkStatus workStatus, double ratingAvg, int ratingCount
});




}
/// @nodoc
class _$ExpertPublicCopyWithImpl<$Res>
    implements $ExpertPublicCopyWith<$Res> {
  _$ExpertPublicCopyWithImpl(this._self, this._then);

  final ExpertPublic _self;
  final $Res Function(ExpertPublic) _then;

/// Create a copy of ExpertPublic
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? displayName = null,Object? city = null,Object? experience = null,Object? priceTiyn = null,Object? languages = null,Object? formats = null,Object? topicSlugs = null,Object? workStatus = null,Object? ratingAvg = null,Object? ratingCount = null,}) {
  return _then(ExpertPublic(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,displayName: null == displayName ? _self.displayName : displayName // ignore: cast_nullable_to_non_nullable
as String,city: null == city ? _self.city : city // ignore: cast_nullable_to_non_nullable
as String,experience: null == experience ? _self.experience : experience // ignore: cast_nullable_to_non_nullable
as ExperienceLevel,priceTiyn: null == priceTiyn ? _self.priceTiyn : priceTiyn // ignore: cast_nullable_to_non_nullable
as int,languages: null == languages ? _self.languages : languages // ignore: cast_nullable_to_non_nullable
as List<String>,formats: null == formats ? _self.formats : formats // ignore: cast_nullable_to_non_nullable
as List<SessionFormat>,topicSlugs: null == topicSlugs ? _self.topicSlugs : topicSlugs // ignore: cast_nullable_to_non_nullable
as List<String>,workStatus: null == workStatus ? _self.workStatus : workStatus // ignore: cast_nullable_to_non_nullable
as WorkStatus,ratingAvg: null == ratingAvg ? _self.ratingAvg : ratingAvg // ignore: cast_nullable_to_non_nullable
as double,ratingCount: null == ratingCount ? _self.ratingCount : ratingCount // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [ExpertPublic].
extension ExpertPublicPatterns on ExpertPublic {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ExpertPublic value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ExpertPublic() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ExpertPublic value)  $default,){
final _that = this;
switch (_that) {
case _ExpertPublic():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ExpertPublic value)?  $default,){
final _that = this;
switch (_that) {
case _ExpertPublic() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String displayName,  String city,  ExperienceLevel experience,  int priceTiyn,  List<String> languages,  List<SessionFormat> formats,  List<String> topicSlugs,  WorkStatus workStatus,  double ratingAvg,  int ratingCount)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ExpertPublic() when $default != null:
return $default(_that.id,_that.displayName,_that.city,_that.experience,_that.priceTiyn,_that.languages,_that.formats,_that.topicSlugs,_that.workStatus,_that.ratingAvg,_that.ratingCount);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String displayName,  String city,  ExperienceLevel experience,  int priceTiyn,  List<String> languages,  List<SessionFormat> formats,  List<String> topicSlugs,  WorkStatus workStatus,  double ratingAvg,  int ratingCount)  $default,) {final _that = this;
switch (_that) {
case _ExpertPublic():
return $default(_that.id,_that.displayName,_that.city,_that.experience,_that.priceTiyn,_that.languages,_that.formats,_that.topicSlugs,_that.workStatus,_that.ratingAvg,_that.ratingCount);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String displayName,  String city,  ExperienceLevel experience,  int priceTiyn,  List<String> languages,  List<SessionFormat> formats,  List<String> topicSlugs,  WorkStatus workStatus,  double ratingAvg,  int ratingCount)?  $default,) {final _that = this;
switch (_that) {
case _ExpertPublic() when $default != null:
return $default(_that.id,_that.displayName,_that.city,_that.experience,_that.priceTiyn,_that.languages,_that.formats,_that.topicSlugs,_that.workStatus,_that.ratingAvg,_that.ratingCount);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ExpertPublic implements ExpertPublic {
  const _ExpertPublic({required this.id, required this.displayName, required this.city, required this.experience, required this.priceTiyn, required  List<String> languages, required  List<SessionFormat> formats, required  List<String> topicSlugs, required this.workStatus, required this.ratingAvg, required this.ratingCount}): _languages = languages,_formats = formats,_topicSlugs = topicSlugs;
  factory _ExpertPublic.fromJson(Map<String, dynamic> json) => _$ExpertPublicFromJson(json);

@override final  String id;
@override final  String displayName;
@override final  String city;
@override final  ExperienceLevel experience;
@override final  int priceTiyn;
 final  List<String> _languages;
@override List<String> get languages {
  if (_languages is EqualUnmodifiableListView) return _languages;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_languages);
}

 final  List<SessionFormat> _formats;
@override List<SessionFormat> get formats {
  if (_formats is EqualUnmodifiableListView) return _formats;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_formats);
}

 final  List<String> _topicSlugs;
@override List<String> get topicSlugs {
  if (_topicSlugs is EqualUnmodifiableListView) return _topicSlugs;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_topicSlugs);
}

@override final  WorkStatus workStatus;
@override final  double ratingAvg;
@override final  int ratingCount;

/// Create a copy of ExpertPublic
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ExpertPublicCopyWith<_ExpertPublic> get copyWith => __$ExpertPublicCopyWithImpl<_ExpertPublic>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ExpertPublicToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ExpertPublic&&(identical(other.id, id) || other.id == id)&&(identical(other.displayName, displayName) || other.displayName == displayName)&&(identical(other.city, city) || other.city == city)&&(identical(other.experience, experience) || other.experience == experience)&&(identical(other.priceTiyn, priceTiyn) || other.priceTiyn == priceTiyn)&&const DeepCollectionEquality().equals(other._languages, _languages)&&const DeepCollectionEquality().equals(other._formats, _formats)&&const DeepCollectionEquality().equals(other._topicSlugs, _topicSlugs)&&(identical(other.workStatus, workStatus) || other.workStatus == workStatus)&&(identical(other.ratingAvg, ratingAvg) || other.ratingAvg == ratingAvg)&&(identical(other.ratingCount, ratingCount) || other.ratingCount == ratingCount));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,displayName,city,experience,priceTiyn,const DeepCollectionEquality().hash(_languages),const DeepCollectionEquality().hash(_formats),const DeepCollectionEquality().hash(_topicSlugs),workStatus,ratingAvg,ratingCount);

@override
String toString() {
  return 'ExpertPublic(id: $id, displayName: $displayName, city: $city, experience: $experience, priceTiyn: $priceTiyn, languages: $languages, formats: $formats, topicSlugs: $topicSlugs, workStatus: $workStatus, ratingAvg: $ratingAvg, ratingCount: $ratingCount)';
}


}

/// @nodoc
abstract mixin class _$ExpertPublicCopyWith<$Res> implements $ExpertPublicCopyWith<$Res> {
  factory _$ExpertPublicCopyWith(_ExpertPublic value, $Res Function(_ExpertPublic) _then) = __$ExpertPublicCopyWithImpl;
@override @useResult
$Res call({
 String id, String displayName, String city, ExperienceLevel experience, int priceTiyn, List<String> languages, List<SessionFormat> formats, List<String> topicSlugs, WorkStatus workStatus, double ratingAvg, int ratingCount
});




}
/// @nodoc
class __$ExpertPublicCopyWithImpl<$Res>
    implements _$ExpertPublicCopyWith<$Res> {
  __$ExpertPublicCopyWithImpl(this._self, this._then);

  final _ExpertPublic _self;
  final $Res Function(_ExpertPublic) _then;

/// Create a copy of ExpertPublic
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? displayName = null,Object? city = null,Object? experience = null,Object? priceTiyn = null,Object? languages = null,Object? formats = null,Object? topicSlugs = null,Object? workStatus = null,Object? ratingAvg = null,Object? ratingCount = null,}) {
  return _then(_ExpertPublic(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,displayName: null == displayName ? _self.displayName : displayName // ignore: cast_nullable_to_non_nullable
as String,city: null == city ? _self.city : city // ignore: cast_nullable_to_non_nullable
as String,experience: null == experience ? _self.experience : experience // ignore: cast_nullable_to_non_nullable
as ExperienceLevel,priceTiyn: null == priceTiyn ? _self.priceTiyn : priceTiyn // ignore: cast_nullable_to_non_nullable
as int,languages: null == languages ? _self._languages : languages // ignore: cast_nullable_to_non_nullable
as List<String>,formats: null == formats ? _self._formats : formats // ignore: cast_nullable_to_non_nullable
as List<SessionFormat>,topicSlugs: null == topicSlugs ? _self._topicSlugs : topicSlugs // ignore: cast_nullable_to_non_nullable
as List<String>,workStatus: null == workStatus ? _self.workStatus : workStatus // ignore: cast_nullable_to_non_nullable
as WorkStatus,ratingAvg: null == ratingAvg ? _self.ratingAvg : ratingAvg // ignore: cast_nullable_to_non_nullable
as double,ratingCount: null == ratingCount ? _self.ratingCount : ratingCount // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}

// dart format on
