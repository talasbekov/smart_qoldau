import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

// Фотография специалиста в аватаре (E2a, задача 7). Фолбэк на инициалы
// обязателен: сеть в мобильном приложении отваливается регулярно, и пустой
// круг вместо специалиста — плохой экран.

// 1×1 прозрачный PNG — настоящие байты, чтобы декодер не спотыкался.
final _pngBytes = Uint8List.fromList([
  0x89,
  0x50,
  0x4E,
  0x47,
  0x0D,
  0x0A,
  0x1A,
  0x0A,
  0x00,
  0x00,
  0x00,
  0x0D,
  0x49,
  0x48,
  0x44,
  0x52,
  0x00,
  0x00,
  0x00,
  0x01,
  0x00,
  0x00,
  0x00,
  0x01,
  0x08,
  0x06,
  0x00,
  0x00,
  0x00,
  0x1F,
  0x15,
  0xC4,
  0x89,
  0x00,
  0x00,
  0x00,
  0x0A,
  0x49,
  0x44,
  0x41,
  0x54,
  0x78,
  0x9C,
  0x63,
  0x00,
  0x01,
  0x00,
  0x00,
  0x05,
  0x00,
  0x01,
  0x0D,
  0x0A,
  0x2D,
  0xB4,
  0x00,
  0x00,
  0x00,
  0x00,
  0x49,
  0x45,
  0x4E,
  0x44,
  0xAE,
  0x42,
  0x60,
  0x82,
]);

Widget _wrap(Widget child) => MaterialApp(
  home: Scaffold(body: Center(child: child)),
);

void main() {
  tearDown(() => SqAvatar.imageProviderFactory = null);

  testWidgets('с photoUrl рисует изображение', (tester) async {
    SqAvatar.imageProviderFactory = (url) => MemoryImage(_pngBytes);

    await tester.pumpWidget(
      _wrap(
        const SqAvatar(name: 'Айгуль С.', photoUrl: 'https://cdn/photo.webp'),
      ),
    );
    await tester.pump();

    expect(find.byType(Image), findsOneWidget);
    expect(find.text('АС'), findsNothing);
  });

  testWidgets('при ошибке загрузки откатывается на инициалы', (tester) async {
    // Загрузчик, который всегда падает: сеть в приложении отваливается
    // регулярно, и это штатный, а не исключительный случай.
    SqAvatar.imageProviderFactory = (url) => _FailingImage();

    await tester.pumpWidget(
      _wrap(
        const SqAvatar(name: 'Айгуль С.', photoUrl: 'https://cdn/photo.webp'),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('АС'), findsOneWidget);
  });

  testWidgets('без photoUrl рисует инициалы и в сеть не ходит', (tester) async {
    var called = false;
    SqAvatar.imageProviderFactory = (url) {
      called = true;
      return MemoryImage(_pngBytes);
    };

    await tester.pumpWidget(_wrap(const SqAvatar(name: 'Айгуль С.')));
    await tester.pump();

    expect(find.text('АС'), findsOneWidget);
    expect(called, isFalse);
  });
}

class _FailingImage extends ImageProvider<_FailingImage> {
  @override
  Future<_FailingImage> obtainKey(ImageConfiguration configuration) async =>
      this;

  @override
  ImageStreamCompleter loadImage(_FailingImage key, ImageDecoderCallback _) =>
      OneFrameImageStreamCompleter(
        Future<ImageInfo>.error(Exception('сеть недоступна')),
      );
}
