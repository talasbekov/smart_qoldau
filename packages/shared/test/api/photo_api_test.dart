// Тесты фото профиля эксперта (E7 задача 6): `PhotoUploadedDto` round-trip,
// `uploadPhoto`/`deletePhoto`, ошибка `PHOTO_INVALID`.
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';
import 'package:shared/shared.dart';

SqApi _buildApi() => SqApi(
  baseUrl: 'https://api.test.local/v1',
  readTokens: () async => null,
  writeTokens: (_) async {},
  onLogout: () async {},
);

void main() {
  late SqApi api;
  late DioAdapter dioAdapter;

  setUp(() {
    api = _buildApi();
    dioAdapter = DioAdapter(dio: api.dio);
  });

  group('PhotoUploadedDto round-trip', () {
    test('fromJson/toJson переносят status', () {
      final dto = PhotoUploadedDto.fromJson({'status': 'PENDING'});
      expect(dto.status, ProfileFieldStatus.pending);

      final json = dto.toJson();
      expect(json['status'], 'PENDING');
    });
  });

  group('SqApiExpertProfile.uploadPhoto', () {
    test(
      'отправляет multipart POST с полем file и разбирает PhotoUploadedDto',
      () async {
        final bytes = [0, 1, 2, 3];
        dioAdapter.onPost(
          '/experts/me/photo',
          (server) => server.reply(202, {'status': 'PENDING'}),
          data: FormData.fromMap({
            'file': MultipartFile.fromBytes(bytes, filename: 'photo.jpg'),
          }),
        );

        final result = await api.uploadPhoto(
          bytes: bytes,
          filename: 'photo.jpg',
        );

        expect(result.status, ProfileFieldStatus.pending);
      },
    );

    test('при PHOTO_INVALID пробрасывает ApiException', () async {
      dioAdapter.onPost(
        '/experts/me/photo',
        (server) => server.reply(400, {
          'error': {'code': 'PHOTO_INVALID', 'message': 'Файл больше 5 МБ'},
        }),
        // `FormData` не переопределяет `toString`/`==`, поэтому
        // `http_mock_adapter` сопоставляет запрос с моком по generic
        // `Instance of 'FormData'` — любой другой экземпляр `FormData`
        // подходит как значение `data:` здесь.
        data: FormData.fromMap({
          'file': MultipartFile.fromBytes(const [
            1,
            2,
            3,
          ], filename: 'photo.jpg'),
        }),
      );

      expect(
        () => api.uploadPhoto(bytes: const [1, 2, 3], filename: 'photo.jpg'),
        throwsA(
          isA<ApiException>().having((e) => e.code, 'code', 'PHOTO_INVALID'),
        ),
      );
    });
  });

  group('SqApiExpertProfile.deletePhoto', () {
    test('отправляет DELETE /experts/me/photo', () async {
      dioAdapter.onDelete(
        '/experts/me/photo',
        (server) => server.reply(204, null),
      );

      await api.deletePhoto();
    });
  });
}
