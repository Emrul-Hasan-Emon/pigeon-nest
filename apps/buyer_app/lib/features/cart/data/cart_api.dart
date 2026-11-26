import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import 'cart_models.dart';

final cartApiProvider = Provider<CartApi>((ref) => CartApi(ref.read(apiClientProvider)));

class CartResult {
  CartResult({required this.cart, required this.notice});
  final Cart? cart;
  final String? notice;

  factory CartResult.fromJson(Map<String, dynamic> json) =>
      CartResult(cart: json['cart'] == null ? null : Cart.fromJson(json['cart'] as Map<String, dynamic>), notice: json['notice'] as String?);
}

/// Every server path this feature uses, in one place (rule 6 in root `rules.md`).
class CartApi {
  CartApi(this._client);
  final ApiClient _client;

  Future<List<Cart>> list() async {
    final json = await _client.get<Map<String, dynamic>>('/carts');
    return (json['carts'] as List).cast<Map<String, dynamic>>().map(Cart.fromJson).toList();
  }

  Future<CartSummary> summary() async {
    final json = await _client.get<Map<String, dynamic>>('/carts/summary');
    return CartSummary.fromJson(json);
  }

  Future<CartResult> add({required int sellerProductId, int? sellerProductSkuId, int? quantity}) async {
    final json = await _client.post<Map<String, dynamic>>('/carts/items', body: {
      'sellerProductId': sellerProductId,
      'sellerProductSkuId': ?sellerProductSkuId,
      'quantity': ?quantity,
    });
    return CartResult.fromJson(json);
  }

  Future<CartResult> setQuantity(int cartId, int itemId, int quantity) async {
    final json = await _client.patch<Map<String, dynamic>>('/carts/$cartId/items/$itemId', body: {'quantity': quantity});
    return CartResult.fromJson(json);
  }

  Future<CartResult> removeItem(int cartId, int itemId) async {
    final json = await _client.delete<Map<String, dynamic>>('/carts/$cartId/items/$itemId');
    return CartResult.fromJson(json);
  }

  Future<void> clear(int cartId) => _client.delete<Object?>('/carts/$cartId');
}
