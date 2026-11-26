import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:buyer_app/app.dart';

void main() {
  testWidgets('App boots to the home shell', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: BuyerApp()));
    await tester.pump();
    expect(find.text('Pigeon Nest'), findsOneWidget);
  });
}
