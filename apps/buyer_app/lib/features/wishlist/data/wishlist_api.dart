import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import 'wishlist_models.dart';

final wishlistApiProvider = Provider<WishlistApi>((ref) => WishlistApi(ref.read(apiClientProvider)));

class WishlistPage {
  WishlistPage({required this.results, required this.nextCursor});
  final List<WishlistItem> results;
  final int? nextCursor;
}

/// Every server path this feature uses, in one place (rule 6 in root `rules.md`).
class WishlistApi {
  WishlistApi(this._client);
  final ApiClient _client;

  Future<WishlistPage> list({int? cursor}) async {
    final json = await _client.get<Map<String, dynamic>>('/wishlist', query: {'cursor': ?cursor});
    return WishlistPage(
      results: (json['results'] as List).cast<Map<String, dynamic>>().map(WishlistItem.fromJson).toList(),
      nextCursor: json['nextCursor'] as int?,
    );
  }

  Future<Set<int>> ids() async {
    final json = await _client.get<Map<String, dynamic>>('/wishlist/ids');
    return (json['productIds'] as List).cast<int>().toSet();
  }

  Future<void> add(int productId) => _client.post<Object?>('/wishlist/$productId');
  Future<void> remove(int productId) => _client.delete<Object?>('/wishlist/$productId');
}
