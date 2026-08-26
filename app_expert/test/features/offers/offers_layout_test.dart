// Раскладка заявок (E14, задача 3) по прототипу
// `docs/Прототип/SmartQoldau Expert Web - Заявки.dc.html`: на широком
// экране карточки идут сеткой в две колонки, на телефоне — прежним
// списком в один столбец.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

import 'package:app_expert/features/offers/ui/offers_list_screen.dart';
import 'package:app_expert/l10n/app_localizations.dart';

OfferDto _offer(String id) => OfferDto(
  offerId: id,
  topicSlug: 'anxiety-stress',
  format: SessionFormat.video,
  isEmergency: false,
  clientCode: 7284,
  deadlineAt: DateTime.now().add(const Duration(seconds: 45)),
);

Future<void> _pumpAt(WidgetTester tester, Size size, {int offers = 4}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        locale: const Locale('ru'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: OffersListScreen(
            offers: AsyncValue.data([
              for (var i = 0; i < offers; i++) _offer('o$i'),
            ]),
            onRefresh: () {},
          ),
        ),
      ),
    ),
  );
  await tester.pump();
}

void main() {
  testWidgets('десктоп: карточки в две колонки', (tester) async {
    await _pumpAt(tester, const Size(1440, 1024));

    final cards = find.byKey(const Key('sq-offer-card'));
    expect(cards, findsNWidgets(4));

    // Две колонки: у первых двух карточек одинаковый верх и разный левый
    // край — именно так выглядит сетка прототипа.
    final first = tester.getTopLeft(cards.at(0));
    final second = tester.getTopLeft(cards.at(1));
    expect(second.dy, first.dy);
    expect(second.dx, greaterThan(first.dx));
  });

  testWidgets('телефон: один столбец, как было до E14', (tester) async {
    await _pumpAt(tester, const Size(390, 844));

    final cards = find.byKey(const Key('sq-offer-card'));
    final first = tester.getTopLeft(cards.at(0));
    final second = tester.getTopLeft(cards.at(1));
    expect(second.dx, first.dx);
    expect(second.dy, greaterThan(first.dy));
  });

  testWidgets('пусто: объяснение, а не белый экран', (tester) async {
    await _pumpAt(tester, const Size(1440, 1024), offers: 0);
    expect(find.textContaining('заяв'), findsWidgets);
  });

  testWidgets('на 1280 dp ничего не переполняется', (tester) async {
    await _pumpAt(tester, const Size(1280, 800));
    expect(tester.takeException(), isNull);
  });
}
