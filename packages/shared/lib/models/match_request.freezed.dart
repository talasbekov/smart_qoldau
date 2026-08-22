// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'match_request.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$MatchRequest {

 String get id; RequestStatus get status; bool get isEmergency; int get clientCode;@JsonKey(includeIfNull: false) ExpertPublic? get matchedExpert;@JsonKey(includeIfNull: false) String? get consultationId;@JsonKey(includeIfNull: false) List<String>? get hotlines;
/// Create a copy of MatchRequest
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$MatchRequestCopyWith<MatchRequest> get copyWith => _$MatchRequestCopyWithImpl<MatchRequest>(this as MatchRequest, _$identity);

  /// Serializes this MatchRequest to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is MatchRequest&&(identical(other.id, id) || other.id == id)&&(identical(other.status, status) || other.status == status)&&(identical(other.isEmergency, isEmergency) || other.isEmergency == isEmergency)&&(identical(other.clientCode, clientCode) || other.clientCode == clientCode)&&(identical(other.matchedExpert, matchedExpert) || other.matchedExpert == matchedExpert)&&(identical(other.consultationId, consultationId) || other.consultationId == consultationId)&&const DeepCollectionEquality().equals(other.hotlines, hotlines));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,status,isEmergency,clientCode,matchedExpert,consultationId,const DeepCollectionEquality().hash(hotlines));

@override
String toString() {
  return 'MatchRequest(id: $id, status: $status, isEmergency: $isEmergency, clientCode: $clientCode, matchedExpert: $matchedExpert, consultationId: $consultationId, hotlines: $hotlines)';
}


}

/// @nodoc
abstract mixin class $MatchRequestCopyWith<$Res>  {
  factory $MatchRequestCopyWith(MatchRequest value, $Res Function(MatchRequest) _then) = _$MatchRequestCopyWithImpl;
@useResult
$Res call({
 String id, RequestStatus status, bool isEmergency, int clientCode,@JsonKey(includeIfNull: false) ExpertPublic? matchedExpert,@JsonKey(includeIfNull: false) String? consultationId,@JsonKey(includeIfNull: false) List<String>? hotlines
});


$ExpertPublicCopyWith<$Res>? get matchedExpert;

}
/// @nodoc
class _$MatchRequestCopyWithImpl<$Res>
    implements $MatchRequestCopyWith<$Res> {
  _$MatchRequestCopyWithImpl(this._self, this._then);

  final MatchRequest _self;
  final $Res Function(MatchRequest) _then;

/// Create a copy of MatchRequest
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? status = null,Object? isEmergency = null,Object? clientCode = null,Object? matchedExpert = freezed,Object? consultationId = freezed,Object? hotlines = freezed,}) {
  return _then(MatchRequest(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as RequestStatus,isEmergency: null == isEmergency ? _self.isEmergency : isEmergency // ignore: cast_nullable_to_non_nullable
as bool,clientCode: null == clientCode ? _self.clientCode : clientCode // ignore: cast_nullable_to_non_nullable
as int,matchedExpert: freezed == matchedExpert ? _self.matchedExpert : matchedExpert // ignore: cast_nullable_to_non_nullable
as ExpertPublic?,consultationId: freezed == consultationId ? _self.consultationId : consultationId // ignore: cast_nullable_to_non_nullable
as String?,hotlines: freezed == hotlines ? _self.hotlines : hotlines // ignore: cast_nullable_to_non_nullable
as List<String>?,
  ));
}
/// Create a copy of MatchRequest
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ExpertPublicCopyWith<$Res>? get matchedExpert {
    if (_self.matchedExpert == null) {
    return null;
  }

  return $ExpertPublicCopyWith<$Res>(_self.matchedExpert!, (value) {
    return _then(_self.copyWith(matchedExpert: value));
  });
}
}


/// Adds pattern-matching-related methods to [MatchRequest].
extension MatchRequestPatterns on MatchRequest {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _MatchRequest value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _MatchRequest() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _MatchRequest value)  $default,){
final _that = this;
switch (_that) {
case _MatchRequest():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _MatchRequest value)?  $default,){
final _that = this;
switch (_that) {
case _MatchRequest() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  RequestStatus status,  bool isEmergency,  int clientCode, @JsonKey(includeIfNull: false)  ExpertPublic? matchedExpert, @JsonKey(includeIfNull: false)  String? consultationId, @JsonKey(includeIfNull: false)  List<String>? hotlines)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _MatchRequest() when $default != null:
return $default(_that.id,_that.status,_that.isEmergency,_that.clientCode,_that.matchedExpert,_that.consultationId,_that.hotlines);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  RequestStatus status,  bool isEmergency,  int clientCode, @JsonKey(includeIfNull: false)  ExpertPublic? matchedExpert, @JsonKey(includeIfNull: false)  String? consultationId, @JsonKey(includeIfNull: false)  List<String>? hotlines)  $default,) {final _that = this;
switch (_that) {
case _MatchRequest():
return $default(_that.id,_that.status,_that.isEmergency,_that.clientCode,_that.matchedExpert,_that.consultationId,_that.hotlines);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  RequestStatus status,  bool isEmergency,  int clientCode, @JsonKey(includeIfNull: false)  ExpertPublic? matchedExpert, @JsonKey(includeIfNull: false)  String? consultationId, @JsonKey(includeIfNull: false)  List<String>? hotlines)?  $default,) {final _that = this;
switch (_that) {
case _MatchRequest() when $default != null:
return $default(_that.id,_that.status,_that.isEmergency,_that.clientCode,_that.matchedExpert,_that.consultationId,_that.hotlines);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _MatchRequest implements MatchRequest {
  const _MatchRequest({required this.id, required this.status, required this.isEmergency, required this.clientCode, @JsonKey(includeIfNull: false) this.matchedExpert, @JsonKey(includeIfNull: false) this.consultationId, @JsonKey(includeIfNull: false)  List<String>? hotlines}): _hotlines = hotlines;
  factory _MatchRequest.fromJson(Map<String, dynamic> json) => _$MatchRequestFromJson(json);

@override final  String id;
@override final  RequestStatus status;
@override final  bool isEmergency;
@override final  int clientCode;
@override@JsonKey(includeIfNull: false) final  ExpertPublic? matchedExpert;
@override@JsonKey(includeIfNull: false) final  String? consultationId;
 final  List<String>? _hotlines;
@override@JsonKey(includeIfNull: false) List<String>? get hotlines {
  final value = _hotlines;
  if (value == null) return null;
  if (_hotlines is EqualUnmodifiableListView) return _hotlines;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}


/// Create a copy of MatchRequest
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$MatchRequestCopyWith<_MatchRequest> get copyWith => __$MatchRequestCopyWithImpl<_MatchRequest>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$MatchRequestToJson(this, );
}

@override
bool operator ==(Object other) {
  return identical(this, other) || (other.runtimeType == runtimeType&&other is _MatchRequest&&(identical(other.id, id) || other.id == id)&&(identical(other.status, status) || other.status == status)&&(identical(other.isEmergency, isEmergency) || other.isEmergency == isEmergency)&&(identical(other.clientCode, clientCode) || other.clientCode == clientCode)&&(identical(other.matchedExpert, matchedExpert) || other.matchedExpert == matchedExpert)&&(identical(other.consultationId, consultationId) || other.consultationId == consultationId)&&const DeepCollectionEquality().equals(other._hotlines, _hotlines));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode => Object.hash(runtimeType,id,status,isEmergency,clientCode,matchedExpert,consultationId,const DeepCollectionEquality().hash(_hotlines));

@override
String toString() {
  return 'MatchRequest(id: $id, status: $status, isEmergency: $isEmergency, clientCode: $clientCode, matchedExpert: $matchedExpert, consultationId: $consultationId, hotlines: $hotlines)';
}


}

/// @nodoc
abstract mixin class _$MatchRequestCopyWith<$Res> implements $MatchRequestCopyWith<$Res> {
  factory _$MatchRequestCopyWith(_MatchRequest value, $Res Function(_MatchRequest) _then) = __$MatchRequestCopyWithImpl;
@override @useResult
$Res call({
 String id, RequestStatus status, bool isEmergency, int clientCode,@JsonKey(includeIfNull: false) ExpertPublic? matchedExpert,@JsonKey(includeIfNull: false) String? consultationId,@JsonKey(includeIfNull: false) List<String>? hotlines
});


@override $ExpertPublicCopyWith<$Res>? get matchedExpert;

}
/// @nodoc
class __$MatchRequestCopyWithImpl<$Res>
    implements _$MatchRequestCopyWith<$Res> {
  __$MatchRequestCopyWithImpl(this._self, this._then);

  final _MatchRequest _self;
  final $Res Function(_MatchRequest) _then;

/// Create a copy of MatchRequest
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? status = null,Object? isEmergency = null,Object? clientCode = null,Object? matchedExpert = freezed,Object? consultationId = freezed,Object? hotlines = freezed,}) {
  return _then(_MatchRequest(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as RequestStatus,isEmergency: null == isEmergency ? _self.isEmergency : isEmergency // ignore: cast_nullable_to_non_nullable
as bool,clientCode: null == clientCode ? _self.clientCode : clientCode // ignore: cast_nullable_to_non_nullable
as int,matchedExpert: freezed == matchedExpert ? _self.matchedExpert : matchedExpert // ignore: cast_nullable_to_non_nullable
as ExpertPublic?,consultationId: freezed == consultationId ? _self.consultationId : consultationId // ignore: cast_nullable_to_non_nullable
as String?,hotlines: freezed == hotlines ? _self._hotlines : hotlines // ignore: cast_nullable_to_non_nullable
as List<String>?,
  ));
}

/// Create a copy of MatchRequest
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ExpertPublicCopyWith<$Res>? get matchedExpert {
    if (_self.matchedExpert == null) {
    return null;
  }

  return $ExpertPublicCopyWith<$Res>(_self.matchedExpert!, (value) {
    return _then(_self.copyWith(matchedExpert: value));
  });
}
}

// dart format on
