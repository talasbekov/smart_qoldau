// Р-27: код отказа, который приложение обязано узнать и обработать.
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

void main() {
  test('код согласия совпадает с тем, что шлёт бэкенд', () {
    // Расхождение здесь означало бы, что человек видит общую ошибку
    // вместо экрана согласия и не понимает, что делать.
    expect(
      ApiErrorCode.expertVisibilityConsentRequired,
      'EXPERT_VISIBILITY_CONSENT_REQUIRED',
    );
  });
}
