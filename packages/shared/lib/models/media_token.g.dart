// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'media_token.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_MediaToken _$MediaTokenFromJson(Map<String, dynamic> json) => _MediaToken(
  token: json['token'] as String,
  url: json['url'] as String,
  room: json['room'] as String,
);

Map<String, dynamic> _$MediaTokenToJson(_MediaToken instance) =>
    <String, dynamic>{
      'token': instance.token,
      'url': instance.url,
      'room': instance.room,
    };
