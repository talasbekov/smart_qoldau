import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

void main() {
  test('sharedPackageMarker identifies the shared package', () {
    expect(sharedPackageMarker, 'smartqoldau-shared');
  });
}
