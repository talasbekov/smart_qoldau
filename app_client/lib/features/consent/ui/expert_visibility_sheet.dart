import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

/// Р-27: согласие на то, что психолог видит имя и историю встреч.
///
/// Показывается по ответу сервера, а не по отдельной проверке на каждом
/// входе: заявку можно завести из нескольких мест, и любой пропущенный
/// путь означал бы непонятную ошибку вместо объяснения.
///
/// Возвращает `true`, если человек согласился, — тогда действие
/// повторяется.
Future<bool> showExpertVisibilityConsent({
  required BuildContext context,
  required Future<void> Function(String displayName) onAccept,
}) async {
  final accepted = await showSqSheetOrDialog<bool>(
    context: context,
    builder: (context) => _ConsentForm(onAccept: onAccept),
  );
  return accepted ?? false;
}

class _ConsentForm extends StatefulWidget {
  const _ConsentForm({required this.onAccept});

  final Future<void> Function(String displayName) onAccept;

  @override
  State<_ConsentForm> createState() => _ConsentFormState();
}

class _ConsentFormState extends State<_ConsentForm> {
  final _controller = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final name = _controller.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'Напишите, как к вам обращаться');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.onAccept(name);
      if (mounted) Navigator.of(context).pop(true);
    } catch (_) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = 'Не удалось сохранить. Попробуйте ещё раз';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      // Клавиатура не должна закрывать поле и кнопку.
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Прежде чем начать', style: theme.textTheme.titleLarge),
          const SizedBox(height: 12),
          Text(
            'Психолог, который будет с вами работать, увидит ваше имя и историю '
            'встреч с ним: когда вы общались, о чём и что он записал по итогам.',
            style: theme.textTheme.bodyMedium,
          ),
          const SizedBox(height: 8),
          // Сказать, чего НЕ видно, не менее важно: иначе человек додумает
          // худшее — например, что видно телефон.
          Text(
            'Ваш телефон психологу не показывается, и другие специалисты вашу '
            'историю не видят.',
            style: theme.textTheme.bodyMedium,
          ),
          const SizedBox(height: 20),
          TextField(
            key: const Key('sq-consent-name'),
            controller: _controller,
            maxLength: 64,
            decoration: const InputDecoration(
              labelText: 'Как к вам обращаться',
              helperText:
                  'Можно указать только имя или любое обращение — документы мы не проверяем',
              helperMaxLines: 2,
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(
              _error!,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.error,
              ),
            ),
          ],
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              key: const Key('sq-consent-submit'),
              onPressed: _busy ? null : _submit,
              child: Text(_busy ? 'Сохраняем…' : 'Продолжить'),
            ),
          ),
        ],
      ),
    );
  }
}
