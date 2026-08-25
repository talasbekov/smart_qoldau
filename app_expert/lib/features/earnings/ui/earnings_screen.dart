/// Доход эксперта (E7 задача 14): баланс сверху, список начислений
/// (цена/комиссия/чистыми), кнопка «Вывести».
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/route_paths.dart';
import '../state/earnings_controller.dart';

class EarningsScreen extends ConsumerWidget {
  const EarningsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(earningsControllerProvider);

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(title: const Text('Доход')),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Text(
            error is ApiException ? error.message : 'Не удалось загрузить доход',
            style: SqTypography.body.copyWith(color: SqColors.danger),
          ),
        ),
        data: (earnings) => RefreshIndicator(
          onRefresh: () => ref.read(earningsControllerProvider.notifier).refresh(),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: SqColors.primary,
                  borderRadius: BorderRadius.circular(SqRadius.m),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Баланс', style: SqTypography.caption.copyWith(color: Colors.white70)),
                    Text(
                      formatTenge(earnings.balanceTiyn),
                      style: SqTypography.h1.copyWith(color: Colors.white),
                    ),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      key: const Key('sq-earnings-payout'),
                      onPressed: () => context.push(RoutePaths.payout),
                      child: const Text('Вывести'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              if (earnings.items.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 24),
                  child: Center(child: Text('Пока нет начислений', style: SqTypography.body)),
                )
              else
                for (final item in earnings.items)
                  Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: SqColors.surface,
                      borderRadius: BorderRadius.circular(SqRadius.m),
                      border: Border.all(color: SqColors.border),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(formatTenge(item.priceTiyn), style: SqTypography.body),
                            Text(
                              'Комиссия: ${formatTenge(item.commissionTiyn)}',
                              style: SqTypography.caption.copyWith(color: SqColors.textSecondary),
                            ),
                          ],
                        ),
                        Text(
                          '+${formatTenge(item.netTiyn)}',
                          style: SqTypography.title.copyWith(color: SqColors.primary),
                        ),
                      ],
                    ),
                  ),
            ],
          ),
        ),
      ),
    );
  }
}
