// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'ticket.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$TicketSummary {

 String get id; String get category; String get subject; String get status; String get team; DateTime get createdAt; DateTime get updatedAt;
/// Create a copy of TicketSummary
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$TicketSummaryCopyWith<TicketSummary> get copyWith => _$TicketSummaryCopyWithImpl<TicketSummary>(this as TicketSummary, _$identity);

  /// Serializes this TicketSummary to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is TicketSummary&&(identical(other.id, id) || other.id == id)&&(identical(other.category, category) || other.category == category)&&(identical(other.subject, subject) || other.subject == subject)&&(identical(other.status, status) || other.status == status)&&(identical(other.team, team) || other.team == team)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,category,subject,status,team,createdAt,updatedAt);

@override
String toString() {
  return 'TicketSummary(id: $id, category: $category, subject: $subject, status: $status, team: $team, createdAt: $createdAt, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class $TicketSummaryCopyWith<$Res>  {
  factory $TicketSummaryCopyWith(TicketSummary value, $Res Function(TicketSummary) _then) = _$TicketSummaryCopyWithImpl;
@useResult
$Res call({
 String id, String category, String subject, String status, String team, DateTime createdAt, DateTime updatedAt
});




}
/// @nodoc
class _$TicketSummaryCopyWithImpl<$Res>
    implements $TicketSummaryCopyWith<$Res> {
  _$TicketSummaryCopyWithImpl(this._self, this._then);

  final TicketSummary _self;
  final $Res Function(TicketSummary) _then;

/// Create a copy of TicketSummary
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? category = null,Object? subject = null,Object? status = null,Object? team = null,Object? createdAt = null,Object? updatedAt = null,}) {
  return _then(TicketSummary(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,category: null == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as String,subject: null == subject ? _self.subject : subject // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,team: null == team ? _self.team : team // ignore: cast_nullable_to_non_nullable
as String,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,updatedAt: null == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as DateTime,
  ));
}

}


/// Adds pattern-matching-related methods to [TicketSummary].
extension TicketSummaryPatterns on TicketSummary {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _TicketSummary value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _TicketSummary() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _TicketSummary value)  $default,){
final _that = this;
switch (_that) {
case _TicketSummary():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _TicketSummary value)?  $default,){
final _that = this;
switch (_that) {
case _TicketSummary() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String category,  String subject,  String status,  String team,  DateTime createdAt,  DateTime updatedAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _TicketSummary() when $default != null:
return $default(_that.id,_that.category,_that.subject,_that.status,_that.team,_that.createdAt,_that.updatedAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String category,  String subject,  String status,  String team,  DateTime createdAt,  DateTime updatedAt)  $default,) {final _that = this;
switch (_that) {
case _TicketSummary():
return $default(_that.id,_that.category,_that.subject,_that.status,_that.team,_that.createdAt,_that.updatedAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String category,  String subject,  String status,  String team,  DateTime createdAt,  DateTime updatedAt)?  $default,) {final _that = this;
switch (_that) {
case _TicketSummary() when $default != null:
return $default(_that.id,_that.category,_that.subject,_that.status,_that.team,_that.createdAt,_that.updatedAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _TicketSummary implements TicketSummary {
  const _TicketSummary({required this.id, required this.category, required this.subject, required this.status, required this.team, required this.createdAt, required this.updatedAt});
  factory _TicketSummary.fromJson(Map<String, dynamic> json) => _$TicketSummaryFromJson(json);

@override final  String id;
@override final  String category;
@override final  String subject;
@override final  String status;
@override final  String team;
@override final  DateTime createdAt;
@override final  DateTime updatedAt;

/// Create a copy of TicketSummary
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$TicketSummaryCopyWith<_TicketSummary> get copyWith => __$TicketSummaryCopyWithImpl<_TicketSummary>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$TicketSummaryToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _TicketSummary&&(identical(other.id, id) || other.id == id)&&(identical(other.category, category) || other.category == category)&&(identical(other.subject, subject) || other.subject == subject)&&(identical(other.status, status) || other.status == status)&&(identical(other.team, team) || other.team == team)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,category,subject,status,team,createdAt,updatedAt);

@override
String toString() {
  return 'TicketSummary(id: $id, category: $category, subject: $subject, status: $status, team: $team, createdAt: $createdAt, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class _$TicketSummaryCopyWith<$Res> implements $TicketSummaryCopyWith<$Res> {
  factory _$TicketSummaryCopyWith(_TicketSummary value, $Res Function(_TicketSummary) _then) = __$TicketSummaryCopyWithImpl;
@override @useResult
$Res call({
 String id, String category, String subject, String status, String team, DateTime createdAt, DateTime updatedAt
});




}
/// @nodoc
class __$TicketSummaryCopyWithImpl<$Res>
    implements _$TicketSummaryCopyWith<$Res> {
  __$TicketSummaryCopyWithImpl(this._self, this._then);

  final _TicketSummary _self;
  final $Res Function(_TicketSummary) _then;

/// Create a copy of TicketSummary
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? category = null,Object? subject = null,Object? status = null,Object? team = null,Object? createdAt = null,Object? updatedAt = null,}) {
  return _then(_TicketSummary(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,category: null == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as String,subject: null == subject ? _self.subject : subject // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,team: null == team ? _self.team : team // ignore: cast_nullable_to_non_nullable
as String,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,updatedAt: null == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as DateTime,
  ));
}


}


/// @nodoc
mixin _$TicketDetail {

 String get id; String get category; String get subject; String get status; String get team; DateTime get createdAt; DateTime get updatedAt; String get body; DateTime? get firstReplyAt; DateTime? get resolvedAt; String? get relatedConsultationId; String? get relatedPayoutId; List<TicketMessage> get messages;
/// Create a copy of TicketDetail
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$TicketDetailCopyWith<TicketDetail> get copyWith => _$TicketDetailCopyWithImpl<TicketDetail>(this as TicketDetail, _$identity);

  /// Serializes this TicketDetail to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is TicketDetail&&(identical(other.id, id) || other.id == id)&&(identical(other.category, category) || other.category == category)&&(identical(other.subject, subject) || other.subject == subject)&&(identical(other.status, status) || other.status == status)&&(identical(other.team, team) || other.team == team)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt)&&(identical(other.body, body) || other.body == body)&&(identical(other.firstReplyAt, firstReplyAt) || other.firstReplyAt == firstReplyAt)&&(identical(other.resolvedAt, resolvedAt) || other.resolvedAt == resolvedAt)&&(identical(other.relatedConsultationId, relatedConsultationId) || other.relatedConsultationId == relatedConsultationId)&&(identical(other.relatedPayoutId, relatedPayoutId) || other.relatedPayoutId == relatedPayoutId)&&const DeepCollectionEquality().equals(other.messages, messages));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,category,subject,status,team,createdAt,updatedAt,body,firstReplyAt,resolvedAt,relatedConsultationId,relatedPayoutId,const DeepCollectionEquality().hash(messages));

@override
String toString() {
  return 'TicketDetail(id: $id, category: $category, subject: $subject, status: $status, team: $team, createdAt: $createdAt, updatedAt: $updatedAt, body: $body, firstReplyAt: $firstReplyAt, resolvedAt: $resolvedAt, relatedConsultationId: $relatedConsultationId, relatedPayoutId: $relatedPayoutId, messages: $messages)';
}


}

/// @nodoc
abstract mixin class $TicketDetailCopyWith<$Res>  {
  factory $TicketDetailCopyWith(TicketDetail value, $Res Function(TicketDetail) _then) = _$TicketDetailCopyWithImpl;
@useResult
$Res call({
 String id, String category, String subject, String status, String team, DateTime createdAt, DateTime updatedAt, String body, DateTime? firstReplyAt, DateTime? resolvedAt, String? relatedConsultationId, String? relatedPayoutId, List<TicketMessage> messages
});




}
/// @nodoc
class _$TicketDetailCopyWithImpl<$Res>
    implements $TicketDetailCopyWith<$Res> {
  _$TicketDetailCopyWithImpl(this._self, this._then);

  final TicketDetail _self;
  final $Res Function(TicketDetail) _then;

/// Create a copy of TicketDetail
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? category = null,Object? subject = null,Object? status = null,Object? team = null,Object? createdAt = null,Object? updatedAt = null,Object? body = null,Object? firstReplyAt = freezed,Object? resolvedAt = freezed,Object? relatedConsultationId = freezed,Object? relatedPayoutId = freezed,Object? messages = null,}) {
  return _then(TicketDetail(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,category: null == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as String,subject: null == subject ? _self.subject : subject // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,team: null == team ? _self.team : team // ignore: cast_nullable_to_non_nullable
as String,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,updatedAt: null == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as DateTime,body: null == body ? _self.body : body // ignore: cast_nullable_to_non_nullable
as String,firstReplyAt: freezed == firstReplyAt ? _self.firstReplyAt : firstReplyAt // ignore: cast_nullable_to_non_nullable
as DateTime?,resolvedAt: freezed == resolvedAt ? _self.resolvedAt : resolvedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,relatedConsultationId: freezed == relatedConsultationId ? _self.relatedConsultationId : relatedConsultationId // ignore: cast_nullable_to_non_nullable
as String?,relatedPayoutId: freezed == relatedPayoutId ? _self.relatedPayoutId : relatedPayoutId // ignore: cast_nullable_to_non_nullable
as String?,messages: null == messages ? _self.messages : messages // ignore: cast_nullable_to_non_nullable
as List<TicketMessage>,
  ));
}

}


/// Adds pattern-matching-related methods to [TicketDetail].
extension TicketDetailPatterns on TicketDetail {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _TicketDetail value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _TicketDetail() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _TicketDetail value)  $default,){
final _that = this;
switch (_that) {
case _TicketDetail():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _TicketDetail value)?  $default,){
final _that = this;
switch (_that) {
case _TicketDetail() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String category,  String subject,  String status,  String team,  DateTime createdAt,  DateTime updatedAt,  String body,  DateTime? firstReplyAt,  DateTime? resolvedAt,  String? relatedConsultationId,  String? relatedPayoutId,  List<TicketMessage> messages)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _TicketDetail() when $default != null:
return $default(_that.id,_that.category,_that.subject,_that.status,_that.team,_that.createdAt,_that.updatedAt,_that.body,_that.firstReplyAt,_that.resolvedAt,_that.relatedConsultationId,_that.relatedPayoutId,_that.messages);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String category,  String subject,  String status,  String team,  DateTime createdAt,  DateTime updatedAt,  String body,  DateTime? firstReplyAt,  DateTime? resolvedAt,  String? relatedConsultationId,  String? relatedPayoutId,  List<TicketMessage> messages)  $default,) {final _that = this;
switch (_that) {
case _TicketDetail():
return $default(_that.id,_that.category,_that.subject,_that.status,_that.team,_that.createdAt,_that.updatedAt,_that.body,_that.firstReplyAt,_that.resolvedAt,_that.relatedConsultationId,_that.relatedPayoutId,_that.messages);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String category,  String subject,  String status,  String team,  DateTime createdAt,  DateTime updatedAt,  String body,  DateTime? firstReplyAt,  DateTime? resolvedAt,  String? relatedConsultationId,  String? relatedPayoutId,  List<TicketMessage> messages)?  $default,) {final _that = this;
switch (_that) {
case _TicketDetail() when $default != null:
return $default(_that.id,_that.category,_that.subject,_that.status,_that.team,_that.createdAt,_that.updatedAt,_that.body,_that.firstReplyAt,_that.resolvedAt,_that.relatedConsultationId,_that.relatedPayoutId,_that.messages);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _TicketDetail implements TicketDetail {
  const _TicketDetail({required this.id, required this.category, required this.subject, required this.status, required this.team, required this.createdAt, required this.updatedAt, required this.body, required this.firstReplyAt, required this.resolvedAt, required this.relatedConsultationId, required this.relatedPayoutId, required  List<TicketMessage> messages}): _messages = messages;
  factory _TicketDetail.fromJson(Map<String, dynamic> json) => _$TicketDetailFromJson(json);

@override final  String id;
@override final  String category;
@override final  String subject;
@override final  String status;
@override final  String team;
@override final  DateTime createdAt;
@override final  DateTime updatedAt;
@override final  String body;
@override final  DateTime? firstReplyAt;
@override final  DateTime? resolvedAt;
@override final  String? relatedConsultationId;
@override final  String? relatedPayoutId;
 final  List<TicketMessage> _messages;
@override List<TicketMessage> get messages {
  if (_messages is EqualUnmodifiableListView) return _messages;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_messages);
}


/// Create a copy of TicketDetail
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$TicketDetailCopyWith<_TicketDetail> get copyWith => __$TicketDetailCopyWithImpl<_TicketDetail>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$TicketDetailToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _TicketDetail&&(identical(other.id, id) || other.id == id)&&(identical(other.category, category) || other.category == category)&&(identical(other.subject, subject) || other.subject == subject)&&(identical(other.status, status) || other.status == status)&&(identical(other.team, team) || other.team == team)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt)&&(identical(other.body, body) || other.body == body)&&(identical(other.firstReplyAt, firstReplyAt) || other.firstReplyAt == firstReplyAt)&&(identical(other.resolvedAt, resolvedAt) || other.resolvedAt == resolvedAt)&&(identical(other.relatedConsultationId, relatedConsultationId) || other.relatedConsultationId == relatedConsultationId)&&(identical(other.relatedPayoutId, relatedPayoutId) || other.relatedPayoutId == relatedPayoutId)&&const DeepCollectionEquality().equals(other._messages, _messages));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,category,subject,status,team,createdAt,updatedAt,body,firstReplyAt,resolvedAt,relatedConsultationId,relatedPayoutId,const DeepCollectionEquality().hash(_messages));

@override
String toString() {
  return 'TicketDetail(id: $id, category: $category, subject: $subject, status: $status, team: $team, createdAt: $createdAt, updatedAt: $updatedAt, body: $body, firstReplyAt: $firstReplyAt, resolvedAt: $resolvedAt, relatedConsultationId: $relatedConsultationId, relatedPayoutId: $relatedPayoutId, messages: $messages)';
}


}

/// @nodoc
abstract mixin class _$TicketDetailCopyWith<$Res> implements $TicketDetailCopyWith<$Res> {
  factory _$TicketDetailCopyWith(_TicketDetail value, $Res Function(_TicketDetail) _then) = __$TicketDetailCopyWithImpl;
@override @useResult
$Res call({
 String id, String category, String subject, String status, String team, DateTime createdAt, DateTime updatedAt, String body, DateTime? firstReplyAt, DateTime? resolvedAt, String? relatedConsultationId, String? relatedPayoutId, List<TicketMessage> messages
});




}
/// @nodoc
class __$TicketDetailCopyWithImpl<$Res>
    implements _$TicketDetailCopyWith<$Res> {
  __$TicketDetailCopyWithImpl(this._self, this._then);

  final _TicketDetail _self;
  final $Res Function(_TicketDetail) _then;

/// Create a copy of TicketDetail
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? category = null,Object? subject = null,Object? status = null,Object? team = null,Object? createdAt = null,Object? updatedAt = null,Object? body = null,Object? firstReplyAt = freezed,Object? resolvedAt = freezed,Object? relatedConsultationId = freezed,Object? relatedPayoutId = freezed,Object? messages = null,}) {
  return _then(_TicketDetail(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,category: null == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as String,subject: null == subject ? _self.subject : subject // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,team: null == team ? _self.team : team // ignore: cast_nullable_to_non_nullable
as String,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,updatedAt: null == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as DateTime,body: null == body ? _self.body : body // ignore: cast_nullable_to_non_nullable
as String,firstReplyAt: freezed == firstReplyAt ? _self.firstReplyAt : firstReplyAt // ignore: cast_nullable_to_non_nullable
as DateTime?,resolvedAt: freezed == resolvedAt ? _self.resolvedAt : resolvedAt // ignore: cast_nullable_to_non_nullable
as DateTime?,relatedConsultationId: freezed == relatedConsultationId ? _self.relatedConsultationId : relatedConsultationId // ignore: cast_nullable_to_non_nullable
as String?,relatedPayoutId: freezed == relatedPayoutId ? _self.relatedPayoutId : relatedPayoutId // ignore: cast_nullable_to_non_nullable
as String?,messages: null == messages ? _self._messages : messages // ignore: cast_nullable_to_non_nullable
as List<TicketMessage>,
  ));
}


}


/// @nodoc
mixin _$TicketMessage {

 String get id; String get authorKind; String get body; DateTime get createdAt;
/// Create a copy of TicketMessage
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$TicketMessageCopyWith<TicketMessage> get copyWith => _$TicketMessageCopyWithImpl<TicketMessage>(this as TicketMessage, _$identity);

  /// Serializes this TicketMessage to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is TicketMessage&&(identical(other.id, id) || other.id == id)&&(identical(other.authorKind, authorKind) || other.authorKind == authorKind)&&(identical(other.body, body) || other.body == body)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,authorKind,body,createdAt);

@override
String toString() {
  return 'TicketMessage(id: $id, authorKind: $authorKind, body: $body, createdAt: $createdAt)';
}


}

/// @nodoc
abstract mixin class $TicketMessageCopyWith<$Res>  {
  factory $TicketMessageCopyWith(TicketMessage value, $Res Function(TicketMessage) _then) = _$TicketMessageCopyWithImpl;
@useResult
$Res call({
 String id, String authorKind, String body, DateTime createdAt
});




}
/// @nodoc
class _$TicketMessageCopyWithImpl<$Res>
    implements $TicketMessageCopyWith<$Res> {
  _$TicketMessageCopyWithImpl(this._self, this._then);

  final TicketMessage _self;
  final $Res Function(TicketMessage) _then;

/// Create a copy of TicketMessage
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? authorKind = null,Object? body = null,Object? createdAt = null,}) {
  return _then(TicketMessage(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,authorKind: null == authorKind ? _self.authorKind : authorKind // ignore: cast_nullable_to_non_nullable
as String,body: null == body ? _self.body : body // ignore: cast_nullable_to_non_nullable
as String,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,
  ));
}

}


/// Adds pattern-matching-related methods to [TicketMessage].
extension TicketMessagePatterns on TicketMessage {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _TicketMessage value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _TicketMessage() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _TicketMessage value)  $default,){
final _that = this;
switch (_that) {
case _TicketMessage():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _TicketMessage value)?  $default,){
final _that = this;
switch (_that) {
case _TicketMessage() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String authorKind,  String body,  DateTime createdAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _TicketMessage() when $default != null:
return $default(_that.id,_that.authorKind,_that.body,_that.createdAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String authorKind,  String body,  DateTime createdAt)  $default,) {final _that = this;
switch (_that) {
case _TicketMessage():
return $default(_that.id,_that.authorKind,_that.body,_that.createdAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String authorKind,  String body,  DateTime createdAt)?  $default,) {final _that = this;
switch (_that) {
case _TicketMessage() when $default != null:
return $default(_that.id,_that.authorKind,_that.body,_that.createdAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _TicketMessage implements TicketMessage {
  const _TicketMessage({required this.id, required this.authorKind, required this.body, required this.createdAt});
  factory _TicketMessage.fromJson(Map<String, dynamic> json) => _$TicketMessageFromJson(json);

@override final  String id;
@override final  String authorKind;
@override final  String body;
@override final  DateTime createdAt;

/// Create a copy of TicketMessage
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$TicketMessageCopyWith<_TicketMessage> get copyWith => __$TicketMessageCopyWithImpl<_TicketMessage>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$TicketMessageToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _TicketMessage&&(identical(other.id, id) || other.id == id)&&(identical(other.authorKind, authorKind) || other.authorKind == authorKind)&&(identical(other.body, body) || other.body == body)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,authorKind,body,createdAt);

@override
String toString() {
  return 'TicketMessage(id: $id, authorKind: $authorKind, body: $body, createdAt: $createdAt)';
}


}

/// @nodoc
abstract mixin class _$TicketMessageCopyWith<$Res> implements $TicketMessageCopyWith<$Res> {
  factory _$TicketMessageCopyWith(_TicketMessage value, $Res Function(_TicketMessage) _then) = __$TicketMessageCopyWithImpl;
@override @useResult
$Res call({
 String id, String authorKind, String body, DateTime createdAt
});




}
/// @nodoc
class __$TicketMessageCopyWithImpl<$Res>
    implements _$TicketMessageCopyWith<$Res> {
  __$TicketMessageCopyWithImpl(this._self, this._then);

  final _TicketMessage _self;
  final $Res Function(_TicketMessage) _then;

/// Create a copy of TicketMessage
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? authorKind = null,Object? body = null,Object? createdAt = null,}) {
  return _then(_TicketMessage(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,authorKind: null == authorKind ? _self.authorKind : authorKind // ignore: cast_nullable_to_non_nullable
as String,body: null == body ? _self.body : body // ignore: cast_nullable_to_non_nullable
as String,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as DateTime,
  ));
}


}

// dart format on
