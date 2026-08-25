/// Экран статуса верификации (E7 задача 6) — единственный источник
/// правды: `ExpertMe` (`verificationStatus`/`photoStatus`/`aboutStatus`/
/// `moderationComment`). У бэкенда нет ни отдельного эндпоинта «моя
/// верификация», ни WS-события о смене статуса — обновление идёт
/// страховочным опросом `GET /experts/me` раз в 30 с, пока
/// `verificationStatus != VERIFIED` (см. `VerificationStatusController`).
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/route_paths.dart';
import '../state/verification_status_controller.dart';

String _verificationLabel(VerificationStatus status) => switch (status) {
  VerificationStatus.draft => 'Анкета не отправлена',
  VerificationStatus.pending => 'Анкета на проверке. Срок рассмотрения — до 24 часов',
  VerificationStatus.verified => 'Верификация пройдена',
};

String _fieldStatusLabel(String fieldName, ProfileFieldStatus status) =>
    switch (status) {
      ProfileFieldStatus.none => '$fieldName: не заполнено',
      ProfileFieldStatus.pending => '$fieldName: на проверке',
      ProfileFieldStatus.approved => '$fieldName: одобрено',
      ProfileFieldStatus.rejected => '$fieldName: отклонено',
    };

class VerificationStatusScreen extends ConsumerWidget {
  const VerificationStatusScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final provider = verificationStatusControllerProvider;

    // Терминальный переход — побочный эффект изменения статуса, а не
    // результат отрисовки (тот же приём, что `SearchScreen` в
    // `app_client`): как только приходит `VERIFIED`, эксперту здесь больше
    // нечего делать — главный экран появится в задаче 10.
    ref.listen(provider, (previous, next) {
      final me = next.valueOrNull;
      if (me == null) return;
      final was = previous?.valueOrNull;
      if (me.verificationStatus == VerificationStatus.verified &&
          was?.verificationStatus != VerificationStatus.verified) {
        context.go(RoutePaths.home);
      }
    });

    final asyncMe = ref.watch(provider);

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(title: const Text('Статус верификации')),
      body: asyncMe.when(
        loading: () => const SqLoader(),
        error: (error, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(SqSpacing.l),
            child: SqErrorView(
              text: error is ApiException
                  ? error.message
                  : 'Не удалось загрузить статус верификации',
              onRetry: () =>
                  ref.read(provider.notifier).refresh(),
            ),
          ),
        ),
        data: (me) => me.verificationStatus == VerificationStatus.verified
            // Экран уже уезжает на главную (см. `ref.listen` выше) — в этом
            // кадре показывать нечего.
            ? const SqLoader()
            : _VerificationContent(me: me),
      ),
    );
  }
}

class _VerificationContent extends StatelessWidget {
  const _VerificationContent({required this.me});

  final ExpertMe me;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(SqSpacing.l),
      children: [
        SqCard(
          child: Text(
            _verificationLabel(me.verificationStatus),
            style: SqTypography.title,
          ),
        ),
        const SizedBox(height: SqSpacing.m),
        SqCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _fieldStatusLabel('Фото', me.photoStatus),
                style: SqTypography.body,
              ),
              const SizedBox(height: SqSpacing.s),
              Text(
                _fieldStatusLabel('О себе', me.aboutStatus),
                style: SqTypography.body,
              ),
              if (me.photoStatus == ProfileFieldStatus.rejected ||
                  me.aboutStatus == ProfileFieldStatus.rejected) ...[
                const SizedBox(height: SqSpacing.m),
                if (me.moderationComment != null)
                  Text(
                    me.moderationComment!,
                    style: SqTypography.body.copyWith(color: SqColors.danger),
                  ),
                // Кнопка ведёт только на PhotoScreen — это единственное
                // реально доступное действие «переисправить», поэтому она
                // показывается, только если отклонено ФОТО. Если отклонено
                // только `about`, кнопки нет вообще: экрана редактирования
                // «о себе» в плане E7 пока не существует ни в этой, ни в
                // одной другой задаче — предлагать эксперту переснимать
                // фото ради правки текста было бы неверным действием
                // (см. ревью задачи 6, раунд правок 1). `moderationComment`
                // выше остаётся информационным для этого случая.
                if (me.photoStatus == ProfileFieldStatus.rejected) ...[
                  const SizedBox(height: SqSpacing.m),
                  SqButton(
                    label: 'Загрузить заново',
                    kind: SqButtonKind.secondary,
                    onPressed: () => context.go(RoutePaths.verificationPhoto),
                  ),
                ],
              ],
            ],
          ),
        ),
      ],
    );
  }
}
