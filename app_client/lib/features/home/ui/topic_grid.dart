/// Сетка тем консультаций главного экрана (Р-14) — тап по теме уводит на
/// `/topic?slug=<slug>` (заглушка до задачи 10).
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

class TopicGrid extends StatelessWidget {
  const TopicGrid({
    super.key,
    required this.topics,
    required this.onTopicTap,
  });

  final List<Topic> topics;
  final ValueChanged<Topic> onTopicTap;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: topics.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        mainAxisSpacing: SqSpacing.s,
        crossAxisSpacing: SqSpacing.s,
        childAspectRatio: 0.95,
      ),
      itemBuilder: (context, index) {
        final topic = topics[index];
        return InkWell(
          key: Key('sq-topic-${topic.slug}'),
          borderRadius: BorderRadius.circular(SqRadius.l),
          onTap: () => onTopicTap(topic),
          child: SqCard(
            padding: const EdgeInsets.all(SqSpacing.s),
            child: Center(
              child: Text(
                topic.name,
                textAlign: TextAlign.center,
                style: SqTypography.caption.copyWith(
                  color: SqColors.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
