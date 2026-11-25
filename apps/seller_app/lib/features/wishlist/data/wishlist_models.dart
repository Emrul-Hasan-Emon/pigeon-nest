String? _s(Object? v) => (v is String && v.isNotEmpty) ? v : null;
Map<String, dynamic> _m(Object? v) => (v as Map<String, dynamic>?) ?? const {};

class SavedProduct {
  SavedProduct(Map<String, dynamic> j)
      : name = j['name'] as String? ?? '',
        thumbnailUrl = _s(j['thumbnailUrl']),
        saves = (j['wishlistCount'] as num?)?.toInt() ?? 0,
        categoryName = _s(_m(j['category'])['name']),
        activeStatus = j['activeStatus'] as String? ?? '';
  final String name, activeStatus;
  final String? thumbnailUrl, categoryName;
  final int saves;
}

/// How often the seller's products are saved. Counts only, never who saved them.
class WishlistInsights {
  WishlistInsights(Map<String, dynamic> j)
      : totalSaves = (j['totalSaves'] as num?)?.toInt() ?? 0,
        productsSaved = (j['productsSaved'] as num?)?.toInt() ?? 0,
        products = (j['products'] as num?)?.toInt() ?? 0,
        top = [for (final p in (j['top'] as List? ?? const [])) SavedProduct(p as Map<String, dynamic>)];
  final int totalSaves, productsSaved, products;
  final List<SavedProduct> top;
}
