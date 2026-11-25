import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import 'wishlist_models.dart';

/// The search text decides what is asked for; an empty text asks for the top 50.
final wishlistInsightsProvider = FutureProvider.autoDispose.family<WishlistInsights, String>((ref, search) async {
  final json = await ref.watch(apiClientProvider).get<Map<String, dynamic>>('/wishlist/insights', query: {
    'limit': 50,
    if (search.trim().isNotEmpty) 'search': search.trim(),
  });
  return WishlistInsights(json);
});
