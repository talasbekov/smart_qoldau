// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'review.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_ReviewCreated _$ReviewCreatedFromJson(Map<String, dynamic> json) =>
    _ReviewCreated(
      id: json['id'] as String,
      consultationId: json['consultationId'] as String,
      rating: (json['rating'] as num).toInt(),
      publicText: json['publicText'] as String?,
      tags:
          (json['tags'] as List<dynamic>?)?.map((e) => e as String).toList() ??
          const <String>[],
      createdAt: DateTime.parse(json['createdAt'] as String),
    );

Map<String, dynamic> _$ReviewCreatedToJson(_ReviewCreated instance) =>
    <String, dynamic>{
      'id': instance.id,
      'consultationId': instance.consultationId,
      'rating': instance.rating,
      'publicText': instance.publicText,
      'tags': instance.tags,
      'createdAt': instance.createdAt.toIso8601String(),
    };

_ReviewItem _$ReviewItemFromJson(Map<String, dynamic> json) => _ReviewItem(
  rating: (json['rating'] as num).toInt(),
  publicText: json['publicText'] as String?,
  expertReply: json['expertReply'] as String?,
  tags:
      (json['tags'] as List<dynamic>?)?.map((e) => e as String).toList() ??
      const <String>[],
  createdAt: DateTime.parse(json['createdAt'] as String),
);

Map<String, dynamic> _$ReviewItemToJson(_ReviewItem instance) =>
    <String, dynamic>{
      'rating': instance.rating,
      'publicText': instance.publicText,
      'expertReply': instance.expertReply,
      'tags': instance.tags,
      'createdAt': instance.createdAt.toIso8601String(),
    };

_RatingDistribution _$RatingDistributionFromJson(Map<String, dynamic> json) =>
    _RatingDistribution(
      rating1: (json['1'] as num).toInt(),
      rating2: (json['2'] as num).toInt(),
      rating3: (json['3'] as num).toInt(),
      rating4: (json['4'] as num).toInt(),
      rating5: (json['5'] as num).toInt(),
    );

Map<String, dynamic> _$RatingDistributionToJson(_RatingDistribution instance) =>
    <String, dynamic>{
      '1': instance.rating1,
      '2': instance.rating2,
      '3': instance.rating3,
      '4': instance.rating4,
      '5': instance.rating5,
    };

_ExpertReviews _$ExpertReviewsFromJson(Map<String, dynamic> json) =>
    _ExpertReviews(
      items: (json['items'] as List<dynamic>)
          .map((e) => ReviewItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      distribution: RatingDistribution.fromJson(
        json['distribution'] as Map<String, dynamic>,
      ),
      ratingAvg: (json['ratingAvg'] as num).toDouble(),
      ratingCount: (json['ratingCount'] as num).toInt(),
    );

Map<String, dynamic> _$ExpertReviewsToJson(_ExpertReviews instance) =>
    <String, dynamic>{
      'items': instance.items.map((e) => e.toJson()).toList(),
      'distribution': instance.distribution.toJson(),
      'ratingAvg': instance.ratingAvg,
      'ratingCount': instance.ratingCount,
    };
