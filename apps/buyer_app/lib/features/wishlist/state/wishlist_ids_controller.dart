import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_controller.dart';
import '../data/wishlist_api.dart';

/// Which product ids are saved — loaded once and kept here so the heart icon
/// on a product tile, the product detail page and the wishlist screen all
/// agree, without each one fetching its own copy. Empty while signed out:
/// wishlist needs an account.
final wishlistIdsProvider = AsyncNotifierProvider<WishlistIdsController, Set<int>>(WishlistIdsController.new);

class WishlistIdsController extends AsyncNotifier<Set<int>> {
  @override
  Future<Set<int>> build() async {
    final signedIn = ref.watch(authProvider).status == AuthStatus.signedIn;
    if (!signedIn) return {};
    return ref.read(wishlistApiProvider).ids();
  }

  Future<void> toggle(int productId) async {
    final ids = Set<int>.from(state.asData?.value ?? {});
    final saved = ids.contains(productId);
    state = AsyncData(saved ? (ids..remove(productId)) : (ids..add(productId)));
    try {
      if (saved) {
        await ref.read(wishlistApiProvider).remove(productId);
      } else {
        await ref.read(wishlistApiProvider).add(productId);
      }
    } catch (e) {
      state = AsyncData(saved ? (ids..add(productId)) : (ids..remove(productId)));
      rethrow;
    }
  }
}
