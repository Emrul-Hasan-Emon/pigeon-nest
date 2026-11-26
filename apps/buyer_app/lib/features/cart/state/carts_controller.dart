import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/cart_api.dart';
import '../data/cart_models.dart';

final cartsProvider = AsyncNotifierProvider<CartsController, List<Cart>>(CartsController.new);

class CartsController extends AsyncNotifier<List<Cart>> {
  @override
  Future<List<Cart>> build() => ref.read(cartApiProvider).list();

  Future<void> reload() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => ref.read(cartApiProvider).list());
  }

  Future<void> addItem({required int sellerProductId, int? sellerProductSkuId, int? quantity}) async {
    await ref.read(cartApiProvider).add(sellerProductId: sellerProductId, sellerProductSkuId: sellerProductSkuId, quantity: quantity);
    await reload();
  }

  Future<void> setQuantity(int cartId, int itemId, int quantity) async {
    final result = await ref.read(cartApiProvider).setQuantity(cartId, itemId, quantity);
    _replace(cartId, result.cart);
  }

  Future<void> removeItem(int cartId, int itemId) async {
    final result = await ref.read(cartApiProvider).removeItem(cartId, itemId);
    _replace(cartId, result.cart);
  }

  Future<void> clear(int cartId) async {
    await ref.read(cartApiProvider).clear(cartId);
    final carts = state.asData?.value ?? [];
    state = AsyncData(carts.where((c) => c.id != cartId).toList());
  }

  void _replace(int cartId, Cart? updated) {
    final carts = state.asData?.value ?? [];
    if (updated == null) {
      state = AsyncData(carts.where((c) => c.id != cartId).toList());
    } else {
      state = AsyncData([for (final c in carts) if (c.id == cartId) updated else c]);
    }
  }
}
