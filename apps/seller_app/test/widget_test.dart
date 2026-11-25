import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:seller_app/app.dart';
import 'package:seller_app/core/api/api_client.dart';
import 'package:seller_app/core/storage/token_store.dart';

class _NoToken extends TokenStore {
  @override
  Future<String?> read() async => null;
}

void main() {
  testWidgets('with no saved token the seller sees the sign-in screen', (tester) async {
    await tester.pumpWidget(ProviderScope(
      overrides: [tokenStoreProvider.overrideWithValue(_NoToken())],
      child: const SellerApp(),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Sign in to your shop'), findsOneWidget);
    expect(find.text('Phone number'), findsOneWidget);
  });
}
