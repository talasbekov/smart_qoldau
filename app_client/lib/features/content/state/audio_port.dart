/// Порт аудиодвижка. Экран знает только «играй эту ссылку» и «пауза»:
/// нативный плеер живёт за этой границей, поэтому виджет-тесты проверяют
/// поведение экрана, а не работу плагина.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';

abstract class AudioPort {
  Future<void> play(String url);
  Future<void> pause();
  Future<void> dispose();
}

class JustAudioPort implements AudioPort {
  JustAudioPort() : _player = AudioPlayer();

  final AudioPlayer _player;
  String? _currentUrl;

  @override
  Future<void> play(String url) async {
    // Ссылка подписана и живёт минуты: при повторном запуске сервер выдаёт
    // новую, и переустанавливать источник обязательно.
    if (_currentUrl != url) {
      await _player.setUrl(url);
      _currentUrl = url;
    }
    await _player.play();
  }

  @override
  Future<void> pause() => _player.pause();

  @override
  Future<void> dispose() => _player.dispose();
}

final audioPortProvider = Provider<AudioPort>((ref) {
  final port = JustAudioPort();
  ref.onDispose(port.dispose);
  return port;
});
