import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

DioException _errorWithResponse({
  required int statusCode,
  required dynamic data,
}) {
  final requestOptions = RequestOptions(path: '/auth/verify-code');
  return DioException(
    requestOptions: requestOptions,
    type: DioExceptionType.badResponse,
    response: Response(
      requestOptions: requestOptions,
      statusCode: statusCode,
      data: data,
    ),
  );
}

void main() {
  group('ApiException.fromDioError', () {
    test(
      'parses code/message/statusCode from the {"error": {...}} envelope',
      () {
        final exception = ApiException.fromDioError(
          _errorWithResponse(
            statusCode: 400,
            data: {
              'error': {'code': 'SMS_CODE_INVALID', 'message': 'Неверный код'},
            },
          ),
        );

        expect(exception.code, 'SMS_CODE_INVALID');
        expect(exception.statusCode, 400);
        expect(exception.message, 'Неверный код');
      },
    );

    test('carries the details payload when present', () {
      final exception = ApiException.fromDioError(
        _errorWithResponse(
          statusCode: 400,
          data: {
            'error': {
              'code': 'VALIDATION_FAILED',
              'message': 'Неверные данные',
              'details': {'field': 'phone'},
            },
          },
        ),
      );

      expect(exception.details, {'field': 'phone'});
    });

    test('maps a response-less error (timeout) to NETWORK', () {
      final exception = ApiException.fromDioError(
        DioException(
          requestOptions: RequestOptions(path: '/topics'),
          type: DioExceptionType.connectionTimeout,
        ),
      );

      expect(exception.code, 'NETWORK');
    });

    test('maps a response with an unparsable body to INTERNAL', () {
      final exception = ApiException.fromDioError(
        _errorWithResponse(statusCode: 502, data: '<html>Bad gateway</html>'),
      );

      expect(exception.code, 'INTERNAL');
      expect(exception.statusCode, 502);
    });

    test('maps a response with no body at all to INTERNAL', () {
      final exception = ApiException.fromDioError(
        _errorWithResponse(statusCode: 500, data: null),
      );

      expect(exception.code, 'INTERNAL');
    });
  });

  group('ApiException.toString', () {
    test('never leaks the request body (phone/SMS code) into its output', () {
      final requestOptions = RequestOptions(
        path: '/auth/verify-code',
        data: {'phone': '+77011234567', 'code': '1234'},
      );
      final exception = ApiException.fromDioError(
        DioException(
          requestOptions: requestOptions,
          type: DioExceptionType.badResponse,
          response: Response(
            requestOptions: requestOptions,
            statusCode: 400,
            data: {
              'error': {'code': 'SMS_CODE_INVALID', 'message': 'Неверный код'},
            },
          ),
        ),
      );

      final rendered = exception.toString();

      expect(rendered, isNot(contains('+77011234567')));
      expect(rendered, isNot(contains('1234')));
    });
  });
}
