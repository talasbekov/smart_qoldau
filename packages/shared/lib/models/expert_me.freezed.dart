// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'expert_me.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$ExpertMe {

 String get id; String get displayName; String get city; ExperienceLevel get experience; String get education; int get priceTiyn; List<String> get languages; List<SessionFormat> get formats; List<String> get topicSlugs; VerificationStatus get verificationStatus; WorkStatus get workStatus; bool get isBlocked; bool get acceptsUrgent; String? get photoUrl; ProfileFieldStatus get photoStatus; String? get about; ProfileFieldStatus get aboutStatus; String? get moderationComment;
/// Create a copy of ExpertMe
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ExpertMeCopyWith<ExpertMe> get copyWith => _$ExpertMeCopyWithImpl<ExpertMe>(this as ExpertMe, _$identity);

  /// Serializes this ExpertMe to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ExpertMe&&(identical(other.id, id) || other.id == id)&&(identical(other.displayName, displayName) || other.displayName == displayName)&&(identical(other.city, city) || other.city == city)&&(identical(other.experience, experience) || other.experience == experience)&&(identical(other.education, education) || other.education == education)&&(identical(other.priceTiyn, priceTiyn) || other.priceTiyn == priceTiyn)&&const DeepCollectionEquality().equals(other.languages, languages)&&const DeepCollectionEquality().equals(other.formats, formats)&&const DeepCollectionEquality().equals(other.topicSlugs, topicSlugs)&&(identical(other.verificationStatus, verificationStatus) || other.verificationStatus == verificationStatus)&&(identical(other.workStatus, workStatus) || other.workStatus == workStatus)&&(identical(other.isBlocked, isBlocked) || other.isBlocked == isBlocked)&&(identical(other.acceptsUrgent, acceptsUrgent) || other.acceptsUrgent == acceptsUrgent)&&(identical(other.photoUrl, photoUrl) || other.photoUrl == photoUrl)&&(identical(other.photoStatus, photoStatus) || other.photoStatus == photoStatus)&&(identical(other.about, about) || other.about == about)&&(identical(other.aboutStatus, aboutStatus) || other.aboutStatus == aboutStatus)&&(identical(other.moderationComment, moderationComment) || other.moderationComment == moderationComment));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,displayName,city,experience,education,priceTiyn,const DeepCollectionEquality().hash(languages),const DeepCollectionEquality().hash(formats),const DeepCollectionEquality().hash(topicSlugs),verificationStatus,workStatus,isBlocked,acceptsUrgent,photoUrl,photoStatus,about,aboutStatus,moderationComment);

@override
String toString() {
  return 'ExpertMe(id: $id, displayName: $displayName, city: $city, experience: $experience, education: $education, priceTiyn: $priceTiyn, languages: $languages, formats: $formats, topicSlugs: $topicSlugs, verificationStatus: $verificationStatus, workStatus: $workStatus, isBlocked: $isBlocked, acceptsUrgent: $acceptsUrgent, photoUrl: $photoUrl, photoStatus: $photoStatus, about: $about, aboutStatus: $aboutStatus, moderationComment: $moderationComment)';
}


}

/// @nodoc
abstract mixin class $ExpertMeCopyWith<$Res>  {
  factory $ExpertMeCopyWith(ExpertMe value, $Res Function(ExpertMe) _then) = _$ExpertMeCopyWithImpl;
@useResult
$Res call({
 String id, String displayName, String city, ExperienceLevel experience, String education, int priceTiyn, List<String> languages, List<SessionFormat> formats, List<String> topicSlugs, VerificationStatus verificationStatus, WorkStatus workStatus, bool isBlocked, bool acceptsUrgent, String? photoUrl, ProfileFieldStatus photoStatus, String? about, ProfileFieldStatus aboutStatus, String? moderationComment
});




}
/// @nodoc
class _$ExpertMeCopyWithImpl<$Res>
    implements $ExpertMeCopyWith<$Res> {
  _$ExpertMeCopyWithImpl(this._self, this._then);

  final ExpertMe _self;
  final $Res Function(ExpertMe) _then;

/// Create a copy of ExpertMe
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? displayName = null,Object? city = null,Object? experience = null,Object? education = null,Object? priceTiyn = null,Object? languages = null,Object? formats = null,Object? topicSlugs = null,Object? verificationStatus = null,Object? workStatus = null,Object? isBlocked = null,Object? acceptsUrgent = null,Object? photoUrl = freezed,Object? photoStatus = null,Object? about = freezed,Object? aboutStatus = null,Object? moderationComment = freezed,}) {
  return _then(ExpertMe(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,displayName: null == displayName ? _self.displayName : displayName // ignore: cast_nullable_to_non_nullable
as String,city: null == city ? _self.city : city // ignore: cast_nullable_to_non_nullable
as String,experience: null == experience ? _self.experience : experience // ignore: cast_nullable_to_non_nullable
as ExperienceLevel,education: null == education ? _self.education : education // ignore: cast_nullable_to_non_nullable
as String,priceTiyn: null == priceTiyn ? _self.priceTiyn : priceTiyn // ignore: cast_nullable_to_non_nullable
as int,languages: null == languages ? _self.languages : languages // ignore: cast_nullable_to_non_nullable
as List<String>,formats: null == formats ? _self.formats : formats // ignore: cast_nullable_to_non_nullable
as List<SessionFormat>,topicSlugs: null == topicSlugs ? _self.topicSlugs : topicSlugs // ignore: cast_nullable_to_non_nullable
as List<String>,verificationStatus: null == verificationStatus ? _self.verificationStatus : verificationStatus // ignore: cast_nullable_to_non_nullable
as VerificationStatus,workStatus: null == workStatus ? _self.workStatus : workStatus // ignore: cast_nullable_to_non_nullable
as WorkStatus,isBlocked: null == isBlocked ? _self.isBlocked : isBlocked // ignore: cast_nullable_to_non_nullable
as bool,acceptsUrgent: null == acceptsUrgent ? _self.acceptsUrgent : acceptsUrgent // ignore: cast_nullable_to_non_nullable
as bool,photoUrl: freezed == photoUrl ? _self.photoUrl : photoUrl // ignore: cast_nullable_to_non_nullable
as String?,photoStatus: null == photoStatus ? _self.photoStatus : photoStatus // ignore: cast_nullable_to_non_nullable
as ProfileFieldStatus,about: freezed == about ? _self.about : about // ignore: cast_nullable_to_non_nullable
as String?,aboutStatus: null == aboutStatus ? _self.aboutStatus : aboutStatus // ignore: cast_nullable_to_non_nullable
as ProfileFieldStatus,moderationComment: freezed == moderationComment ? _self.moderationComment : moderationComment // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [ExpertMe].
extension ExpertMePatterns on ExpertMe {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ExpertMe value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ExpertMe() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ExpertMe value)  $default,){
final _that = this;
switch (_that) {
case _ExpertMe():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ExpertMe value)?  $default,){
final _that = this;
switch (_that) {
case _ExpertMe() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String displayName,  String city,  ExperienceLevel experience,  String education,  int priceTiyn,  List<String> languages,  List<SessionFormat> formats,  List<String> topicSlugs,  VerificationStatus verificationStatus,  WorkStatus workStatus,  bool isBlocked,  bool acceptsUrgent,  String? photoUrl,  ProfileFieldStatus photoStatus,  String? about,  ProfileFieldStatus aboutStatus,  String? moderationComment)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ExpertMe() when $default != null:
return $default(_that.id,_that.displayName,_that.city,_that.experience,_that.education,_that.priceTiyn,_that.languages,_that.formats,_that.topicSlugs,_that.verificationStatus,_that.workStatus,_that.isBlocked,_that.acceptsUrgent,_that.photoUrl,_that.photoStatus,_that.about,_that.aboutStatus,_that.moderationComment);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String displayName,  String city,  ExperienceLevel experience,  String education,  int priceTiyn,  List<String> languages,  List<SessionFormat> formats,  List<String> topicSlugs,  VerificationStatus verificationStatus,  WorkStatus workStatus,  bool isBlocked,  bool acceptsUrgent,  String? photoUrl,  ProfileFieldStatus photoStatus,  String? about,  ProfileFieldStatus aboutStatus,  String? moderationComment)  $default,) {final _that = this;
switch (_that) {
case _ExpertMe():
return $default(_that.id,_that.displayName,_that.city,_that.experience,_that.education,_that.priceTiyn,_that.languages,_that.formats,_that.topicSlugs,_that.verificationStatus,_that.workStatus,_that.isBlocked,_that.acceptsUrgent,_that.photoUrl,_that.photoStatus,_that.about,_that.aboutStatus,_that.moderationComment);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String displayName,  String city,  ExperienceLevel experience,  String education,  int priceTiyn,  List<String> languages,  List<SessionFormat> formats,  List<String> topicSlugs,  VerificationStatus verificationStatus,  WorkStatus workStatus,  bool isBlocked,  bool acceptsUrgent,  String? photoUrl,  ProfileFieldStatus photoStatus,  String? about,  ProfileFieldStatus aboutStatus,  String? moderationComment)?  $default,) {final _that = this;
switch (_that) {
case _ExpertMe() when $default != null:
return $default(_that.id,_that.displayName,_that.city,_that.experience,_that.education,_that.priceTiyn,_that.languages,_that.formats,_that.topicSlugs,_that.verificationStatus,_that.workStatus,_that.isBlocked,_that.acceptsUrgent,_that.photoUrl,_that.photoStatus,_that.about,_that.aboutStatus,_that.moderationComment);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ExpertMe implements ExpertMe {
  const _ExpertMe({required this.id, required this.displayName, required this.city, required this.experience, required this.education, required this.priceTiyn, required  List<String> languages, required  List<SessionFormat> formats, required  List<String> topicSlugs, required this.verificationStatus, required this.workStatus, required this.isBlocked, required this.acceptsUrgent, this.photoUrl, required this.photoStatus, this.about, required this.aboutStatus, this.moderationComment}): _languages = languages,_formats = formats,_topicSlugs = topicSlugs;
  factory _ExpertMe.fromJson(Map<String, dynamic> json) => _$ExpertMeFromJson(json);

@override final  String id;
@override final  String displayName;
@override final  String city;
@override final  ExperienceLevel experience;
@override final  String education;
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

@override final  VerificationStatus verificationStatus;
@override final  WorkStatus workStatus;
@override final  bool isBlocked;
@override final  bool acceptsUrgent;
@override final  String? photoUrl;
@override final  ProfileFieldStatus photoStatus;
@override final  String? about;
@override final  ProfileFieldStatus aboutStatus;
@override final  String? moderationComment;

/// Create a copy of ExpertMe
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ExpertMeCopyWith<_ExpertMe> get copyWith => __$ExpertMeCopyWithImpl<_ExpertMe>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ExpertMeToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _ExpertMe&&(identical(other.id, id) || other.id == id)&&(identical(other.displayName, displayName) || other.displayName == displayName)&&(identical(other.city, city) || other.city == city)&&(identical(other.experience, experience) || other.experience == experience)&&(identical(other.education, education) || other.education == education)&&(identical(other.priceTiyn, priceTiyn) || other.priceTiyn == priceTiyn)&&const DeepCollectionEquality().equals(other._languages, _languages)&&const DeepCollectionEquality().equals(other._formats, _formats)&&const DeepCollectionEquality().equals(other._topicSlugs, _topicSlugs)&&(identical(other.verificationStatus, verificationStatus) || other.verificationStatus == verificationStatus)&&(identical(other.workStatus, workStatus) || other.workStatus == workStatus)&&(identical(other.isBlocked, isBlocked) || other.isBlocked == isBlocked)&&(identical(other.acceptsUrgent, acceptsUrgent) || other.acceptsUrgent == acceptsUrgent)&&(identical(other.photoUrl, photoUrl) || other.photoUrl == photoUrl)&&(identical(other.photoStatus, photoStatus) || other.photoStatus == photoStatus)&&(identical(other.about, about) || other.about == about)&&(identical(other.aboutStatus, aboutStatus) || other.aboutStatus == aboutStatus)&&(identical(other.moderationComment, moderationComment) || other.moderationComment == moderationComment));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,displayName,city,experience,education,priceTiyn,const DeepCollectionEquality().hash(_languages),const DeepCollectionEquality().hash(_formats),const DeepCollectionEquality().hash(_topicSlugs),verificationStatus,workStatus,isBlocked,acceptsUrgent,photoUrl,photoStatus,about,aboutStatus,moderationComment);

@override
String toString() {
  return 'ExpertMe(id: $id, displayName: $displayName, city: $city, experience: $experience, education: $education, priceTiyn: $priceTiyn, languages: $languages, formats: $formats, topicSlugs: $topicSlugs, verificationStatus: $verificationStatus, workStatus: $workStatus, isBlocked: $isBlocked, acceptsUrgent: $acceptsUrgent, photoUrl: $photoUrl, photoStatus: $photoStatus, about: $about, aboutStatus: $aboutStatus, moderationComment: $moderationComment)';
}


}

/// @nodoc
abstract mixin class _$ExpertMeCopyWith<$Res> implements $ExpertMeCopyWith<$Res> {
  factory _$ExpertMeCopyWith(_ExpertMe value, $Res Function(_ExpertMe) _then) = __$ExpertMeCopyWithImpl;
@override @useResult
$Res call({
 String id, String displayName, String city, ExperienceLevel experience, String education, int priceTiyn, List<String> languages, List<SessionFormat> formats, List<String> topicSlugs, VerificationStatus verificationStatus, WorkStatus workStatus, bool isBlocked, bool acceptsUrgent, String? photoUrl, ProfileFieldStatus photoStatus, String? about, ProfileFieldStatus aboutStatus, String? moderationComment
});




}
/// @nodoc
class __$ExpertMeCopyWithImpl<$Res>
    implements _$ExpertMeCopyWith<$Res> {
  __$ExpertMeCopyWithImpl(this._self, this._then);

  final _ExpertMe _self;
  final $Res Function(_ExpertMe) _then;

/// Create a copy of ExpertMe
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? displayName = null,Object? city = null,Object? experience = null,Object? education = null,Object? priceTiyn = null,Object? languages = null,Object? formats = null,Object? topicSlugs = null,Object? verificationStatus = null,Object? workStatus = null,Object? isBlocked = null,Object? acceptsUrgent = null,Object? photoUrl = freezed,Object? photoStatus = null,Object? about = freezed,Object? aboutStatus = null,Object? moderationComment = freezed,}) {
  return _then(_ExpertMe(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,displayName: null == displayName ? _self.displayName : displayName // ignore: cast_nullable_to_non_nullable
as String,city: null == city ? _self.city : city // ignore: cast_nullable_to_non_nullable
as String,experience: null == experience ? _self.experience : experience // ignore: cast_nullable_to_non_nullable
as ExperienceLevel,education: null == education ? _self.education : education // ignore: cast_nullable_to_non_nullable
as String,priceTiyn: null == priceTiyn ? _self.priceTiyn : priceTiyn // ignore: cast_nullable_to_non_nullable
as int,languages: null == languages ? _self._languages : languages // ignore: cast_nullable_to_non_nullable
as List<String>,formats: null == formats ? _self._formats : formats // ignore: cast_nullable_to_non_nullable
as List<SessionFormat>,topicSlugs: null == topicSlugs ? _self._topicSlugs : topicSlugs // ignore: cast_nullable_to_non_nullable
as List<String>,verificationStatus: null == verificationStatus ? _self.verificationStatus : verificationStatus // ignore: cast_nullable_to_non_nullable
as VerificationStatus,workStatus: null == workStatus ? _self.workStatus : workStatus // ignore: cast_nullable_to_non_nullable
as WorkStatus,isBlocked: null == isBlocked ? _self.isBlocked : isBlocked // ignore: cast_nullable_to_non_nullable
as bool,acceptsUrgent: null == acceptsUrgent ? _self.acceptsUrgent : acceptsUrgent // ignore: cast_nullable_to_non_nullable
as bool,photoUrl: freezed == photoUrl ? _self.photoUrl : photoUrl // ignore: cast_nullable_to_non_nullable
as String?,photoStatus: null == photoStatus ? _self.photoStatus : photoStatus // ignore: cast_nullable_to_non_nullable
as ProfileFieldStatus,about: freezed == about ? _self.about : about // ignore: cast_nullable_to_non_nullable
as String?,aboutStatus: null == aboutStatus ? _self.aboutStatus : aboutStatus // ignore: cast_nullable_to_non_nullable
as ProfileFieldStatus,moderationComment: freezed == moderationComment ? _self.moderationComment : moderationComment // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}

// dart format on
