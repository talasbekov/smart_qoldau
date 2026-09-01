// Прямой round-trip тест ExpertMe.fromJson/toJson — все 18 полей,
// enum'ы с @JsonValue, nullable-поля.
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

void main() {
  group('ExpertMe serialization', () {
    test('fromJson разбирает полный профиль со всеми полями', () {
      final json = {
        'id': 'exp-123',
        'displayName': 'Айгуль Серикова',
        'city': 'Алматы',
        'experience': 'THREE_TO_FIVE',
        'education': 'КазНУ им. Аль-Фараби, психология',
        'priceTiyn': 750000,
        'languages': ['ru', 'kz', 'en'],
        'formats': ['chat', 'audio', 'video'],
        'topicSlugs': ['anxiety', 'stress', 'depression'],
        'verificationStatus': 'VERIFIED',
        'workStatus': 'ACCEPTING',
        'isBlocked': false,
        'acceptsUrgent': true,
        'photoUrl': 'https://example.com/photo.jpg',
        'photoStatus': 'APPROVED',
        'about': 'Психолог с опытом работы 7 лет',
        'aboutStatus': 'APPROVED',
        'moderationComment': null,
      };

      final expert = ExpertMe.fromJson(json);

      expect(expert.id, 'exp-123');
      expect(expert.displayName, 'Айгуль Серикова');
      expect(expert.city, 'Алматы');
      expect(expert.experience, ExperienceLevel.threeToFive);
      expect(expert.education, 'КазНУ им. Аль-Фараби, психология');
      expect(expert.priceTiyn, 750000);
      expect(expert.languages, ['ru', 'kz', 'en']);
      expect(expert.formats, [
        SessionFormat.chat,
        SessionFormat.audio,
        SessionFormat.video,
      ]);
      expect(expert.topicSlugs, ['anxiety', 'stress', 'depression']);
      expect(expert.verificationStatus, VerificationStatus.verified);
      expect(expert.workStatus, WorkStatus.accepting);
      expect(expert.isBlocked, false);
      expect(expert.acceptsUrgent, true);
      expect(expert.photoUrl, 'https://example.com/photo.jpg');
      expect(expert.photoStatus, ProfileFieldStatus.approved);
      expect(expert.about, 'Психолог с опытом работы 7 лет');
      expect(expert.aboutStatus, ProfileFieldStatus.approved);
      expect(expert.moderationComment, isNull);
    });

    test('toJson преобразует все enum-ы в @JsonValue и сохраняет все поля', () {
      final expert = ExpertMe(
        id: 'exp-456',
        displayName: 'Константин Петров',
        city: 'Москва',
        experience: ExperienceLevel.fiveToTen,
        education: 'МГУ, социология',
        priceTiyn: 500000,
        languages: ['ru'],
        formats: [SessionFormat.video],
        topicSlugs: ['relationships'],
        verificationStatus: VerificationStatus.pending,
        workStatus: WorkStatus.busy,
        isBlocked: false,
        acceptsUrgent: false,
        photoUrl: null,
        photoStatus: ProfileFieldStatus.pending,
        about: null,
        aboutStatus: ProfileFieldStatus.none,
        moderationComment: 'Требуется повторное утверждение фото',
      );

      final json = expert.toJson();

      expect(json['id'], 'exp-456');
      expect(json['displayName'], 'Константин Петров');
      expect(json['city'], 'Москва');
      expect(json['experience'], 'FIVE_TO_TEN');
      expect(json['education'], 'МГУ, социология');
      expect(json['priceTiyn'], 500000);
      expect(json['languages'], ['ru']);
      expect(json['formats'], ['video']);
      expect(json['topicSlugs'], ['relationships']);
      expect(json['verificationStatus'], 'PENDING');
      expect(json['workStatus'], 'BUSY');
      expect(json['isBlocked'], false);
      expect(json['acceptsUrgent'], false);
      expect(json['photoUrl'], isNull);
      expect(json['photoStatus'], 'PENDING');
      expect(json['about'], isNull);
      expect(json['aboutStatus'], 'NONE');
      expect(json['moderationComment'], 'Требуется повторное утверждение фото');
    });

    test('round-trip: fromJson -> toJson воспроизводит исходный JSON', () {
      final original = {
        'id': 'exp-789',
        'displayName': 'Марат Ситдиков',
        'city': 'Бишкек',
        'experience': 'ONE_TO_THREE',
        'education': 'КРСУ, политология',
        'priceTiyn': 350000,
        'languages': ['ky', 'ru'],
        'formats': ['chat', 'audio'],
        'topicSlugs': ['politics', 'history'],
        'verificationStatus': 'DRAFT',
        'workStatus': 'NOT_ACCEPTING',
        'isBlocked': true,
        'acceptsUrgent': false,
        'photoUrl': null,
        'photoStatus': 'REJECTED',
        'about': 'Политолог-эксперт по Центральной Азии',
        'aboutStatus': 'REJECTED',
        'moderationComment': 'Материал в bio требует модерации',
      };

      final expert = ExpertMe.fromJson(original);
      final reconstructed = expert.toJson();

      expect(reconstructed, original);
    });

    test('enum VerificationStatus - все значения переводятся в @JsonValue', () {
      final draftJson = ExpertMe(
        id: 'e1',
        displayName: 'Test',
        city: 'C',
        experience: ExperienceLevel.lessThanYear,
        education: 'E',
        priceTiyn: 100000,
        languages: ['ru'],
        formats: [SessionFormat.chat],
        topicSlugs: ['t'],
        verificationStatus: VerificationStatus.draft,
        workStatus: WorkStatus.accepting,
        isBlocked: false,
        acceptsUrgent: false,
        photoStatus: ProfileFieldStatus.none,
        aboutStatus: ProfileFieldStatus.none,
      ).toJson();

      expect(draftJson['verificationStatus'], 'DRAFT');

      final pendingJson = ExpertMe(
        id: 'e2',
        displayName: 'Test',
        city: 'C',
        experience: ExperienceLevel.lessThanYear,
        education: 'E',
        priceTiyn: 100000,
        languages: ['ru'],
        formats: [SessionFormat.chat],
        topicSlugs: ['t'],
        verificationStatus: VerificationStatus.pending,
        workStatus: WorkStatus.accepting,
        isBlocked: false,
        acceptsUrgent: false,
        photoStatus: ProfileFieldStatus.none,
        aboutStatus: ProfileFieldStatus.none,
      ).toJson();

      expect(pendingJson['verificationStatus'], 'PENDING');

      final verifiedJson = ExpertMe(
        id: 'e3',
        displayName: 'Test',
        city: 'C',
        experience: ExperienceLevel.lessThanYear,
        education: 'E',
        priceTiyn: 100000,
        languages: ['ru'],
        formats: [SessionFormat.chat],
        topicSlugs: ['t'],
        verificationStatus: VerificationStatus.verified,
        workStatus: WorkStatus.accepting,
        isBlocked: false,
        acceptsUrgent: false,
        photoStatus: ProfileFieldStatus.none,
        aboutStatus: ProfileFieldStatus.none,
      ).toJson();

      expect(verifiedJson['verificationStatus'], 'VERIFIED');
    });

    test('enum ProfileFieldStatus - все значения переводятся в @JsonValue', () {
      final noneJson = ExpertMe(
        id: 'e1',
        displayName: 'Test',
        city: 'C',
        experience: ExperienceLevel.lessThanYear,
        education: 'E',
        priceTiyn: 100000,
        languages: ['ru'],
        formats: [SessionFormat.chat],
        topicSlugs: ['t'],
        verificationStatus: VerificationStatus.draft,
        workStatus: WorkStatus.accepting,
        isBlocked: false,
        acceptsUrgent: false,
        photoStatus: ProfileFieldStatus.none,
        aboutStatus: ProfileFieldStatus.none,
      ).toJson();

      expect(noneJson['photoStatus'], 'NONE');
      expect(noneJson['aboutStatus'], 'NONE');

      final pendingJson = ExpertMe(
        id: 'e2',
        displayName: 'Test',
        city: 'C',
        experience: ExperienceLevel.lessThanYear,
        education: 'E',
        priceTiyn: 100000,
        languages: ['ru'],
        formats: [SessionFormat.chat],
        topicSlugs: ['t'],
        verificationStatus: VerificationStatus.draft,
        workStatus: WorkStatus.accepting,
        isBlocked: false,
        acceptsUrgent: false,
        photoStatus: ProfileFieldStatus.pending,
        aboutStatus: ProfileFieldStatus.pending,
      ).toJson();

      expect(pendingJson['photoStatus'], 'PENDING');
      expect(pendingJson['aboutStatus'], 'PENDING');

      final approvedJson = ExpertMe(
        id: 'e3',
        displayName: 'Test',
        city: 'C',
        experience: ExperienceLevel.lessThanYear,
        education: 'E',
        priceTiyn: 100000,
        languages: ['ru'],
        formats: [SessionFormat.chat],
        topicSlugs: ['t'],
        verificationStatus: VerificationStatus.draft,
        workStatus: WorkStatus.accepting,
        isBlocked: false,
        acceptsUrgent: false,
        photoStatus: ProfileFieldStatus.approved,
        aboutStatus: ProfileFieldStatus.approved,
      ).toJson();

      expect(approvedJson['photoStatus'], 'APPROVED');
      expect(approvedJson['aboutStatus'], 'APPROVED');

      final rejectedJson = ExpertMe(
        id: 'e4',
        displayName: 'Test',
        city: 'C',
        experience: ExperienceLevel.lessThanYear,
        education: 'E',
        priceTiyn: 100000,
        languages: ['ru'],
        formats: [SessionFormat.chat],
        topicSlugs: ['t'],
        verificationStatus: VerificationStatus.draft,
        workStatus: WorkStatus.accepting,
        isBlocked: false,
        acceptsUrgent: false,
        photoStatus: ProfileFieldStatus.rejected,
        aboutStatus: ProfileFieldStatus.rejected,
      ).toJson();

      expect(rejectedJson['photoStatus'], 'REJECTED');
      expect(rejectedJson['aboutStatus'], 'REJECTED');
    });

    test('SessionFormat в formats сериализуется в lowercase wireValue', () {
      final expert = ExpertMe(
        id: 'e1',
        displayName: 'Test',
        city: 'C',
        experience: ExperienceLevel.lessThanYear,
        education: 'E',
        priceTiyn: 100000,
        languages: ['ru'],
        formats: [SessionFormat.chat, SessionFormat.audio, SessionFormat.video],
        topicSlugs: ['t'],
        verificationStatus: VerificationStatus.draft,
        workStatus: WorkStatus.accepting,
        isBlocked: false,
        acceptsUrgent: false,
        photoStatus: ProfileFieldStatus.none,
        aboutStatus: ProfileFieldStatus.none,
      );

      final json = expert.toJson();
      expect(json['formats'], ['chat', 'audio', 'video']);

      // Verify round-trip
      final parsed = ExpertMe.fromJson(json);
      expect(parsed.formats, [
        SessionFormat.chat,
        SessionFormat.audio,
        SessionFormat.video,
      ]);
    });

    test('nullable поля (photoUrl, about, moderationComment) корректно сохраняются как null', () {
      final expertWithNulls = ExpertMe(
        id: 'e1',
        displayName: 'Test',
        city: 'C',
        experience: ExperienceLevel.lessThanYear,
        education: 'E',
        priceTiyn: 100000,
        languages: ['ru'],
        formats: [SessionFormat.chat],
        topicSlugs: ['t'],
        verificationStatus: VerificationStatus.draft,
        workStatus: WorkStatus.accepting,
        isBlocked: false,
        acceptsUrgent: false,
        photoUrl: null,
        photoStatus: ProfileFieldStatus.none,
        about: null,
        aboutStatus: ProfileFieldStatus.none,
        moderationComment: null,
      );

      final json = expertWithNulls.toJson();
      expect(json['photoUrl'], isNull);
      expect(json['about'], isNull);
      expect(json['moderationComment'], isNull);

      final parsed = ExpertMe.fromJson(json);
      expect(parsed.photoUrl, isNull);
      expect(parsed.about, isNull);
      expect(parsed.moderationComment, isNull);
    });

    test('nullable поля с значениями сохраняются корректно', () {
      final expertWithValues = ExpertMe(
        id: 'e1',
        displayName: 'Test',
        city: 'C',
        experience: ExperienceLevel.lessThanYear,
        education: 'E',
        priceTiyn: 100000,
        languages: ['ru'],
        formats: [SessionFormat.chat],
        topicSlugs: ['t'],
        verificationStatus: VerificationStatus.draft,
        workStatus: WorkStatus.accepting,
        isBlocked: false,
        acceptsUrgent: false,
        photoUrl: 'https://example.com/photo.jpg',
        photoStatus: ProfileFieldStatus.none,
        about: 'Опытный психолог',
        aboutStatus: ProfileFieldStatus.none,
        moderationComment: 'Требуется обновление',
      );

      final json = expertWithValues.toJson();
      expect(json['photoUrl'], 'https://example.com/photo.jpg');
      expect(json['about'], 'Опытный психолог');
      expect(json['moderationComment'], 'Требуется обновление');

      final parsed = ExpertMe.fromJson(json);
      expect(parsed.photoUrl, 'https://example.com/photo.jpg');
      expect(parsed.about, 'Опытный психолог');
      expect(parsed.moderationComment, 'Требуется обновление');
    });
  });
}
