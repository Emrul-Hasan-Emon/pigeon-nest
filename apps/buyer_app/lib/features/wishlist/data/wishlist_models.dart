import '../../../core/config/app_config.dart';

String? _media(String? url) => url == null ? null : AppConfig.mediaUrl(url);

class WishlistItem {
  WishlistItem({required this.id, required this.productId, required this.name, required this.slug, required this.thumbnailUrl, required this.sellerName, required this.price, required this.stock, required this.availability});
  final int id;
  final int productId;
  final String? name;
  final String? slug;
  final String? thumbnailUrl;
  final String? sellerName;
  final num? price;
  final int stock;
  final String availability;

  bool get isAvailable => availability == 'available';

  factory WishlistItem.fromJson(Map<String, dynamic> json) {
    final seller = json['seller'] as Map<String, dynamic>?;
    return WishlistItem(
      id: json['id'] as int,
      productId: json['productId'] as int,
      name: json['name'] as String?,
      slug: json['slug'] as String?,
      thumbnailUrl: _media(json['thumbnailUrl'] as String?),
      sellerName: seller?['name'] as String?,
      price: json['price'] as num?,
      stock: (json['stock'] as num?)?.toInt() ?? 0,
      availability: json['availability'] as String,
    );
  }
}
