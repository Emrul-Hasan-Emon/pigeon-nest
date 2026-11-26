import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import 'checkout_models.dart';

final checkoutApiProvider = Provider<CheckoutApi>((ref) => CheckoutApi(ref.read(apiClientProvider)));

/// Every server path this feature uses, in one place (rule 6 in root `rules.md`).
class CheckoutApi {
  CheckoutApi(this._client);
  final ApiClient _client;

  Future<CheckoutOptions> options(int cartId, {String? countryCode}) async {
    final json = await _client.get<Map<String, dynamic>>('/order/checkout/$cartId', query: countryCode == null ? null : {'countryCode': countryCode});
    return CheckoutOptions.fromJson(json);
  }

  Future<PlacedOrder> place(int cartId, PlaceOrderInput input) async {
    final json = await _client.post<Map<String, dynamic>>('/order/checkout/$cartId/place', body: input.toJson());
    return PlacedOrder.fromJson(json);
  }
}
