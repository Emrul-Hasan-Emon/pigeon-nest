import '../../../core/config/app_config.dart';

String? _media(String? url) => url == null ? null : AppConfig.mediaUrl(url);

class CartLine {
  CartLine({
    required this.id,
    required this.productName,
    required this.productId,
    required this.thumbnailUrl,
    required this.skuLabel,
    required this.quantity,
    required this.unitPayable,
    required this.skuUnitPayable,
    required this.linePayable,
    required this.availableQuantity,
    required this.status,
    required this.proposalNotice,
  });
  final int id;
  final String productName;
  final int? productId;
  final String? thumbnailUrl;
  final String skuLabel;
  final int quantity;
  final num unitPayable;
  final num skuUnitPayable;
  final num linePayable;
  final int availableQuantity;
  final String status;
  final String? proposalNotice;

  bool get isOk => status == 'ok';
  /// Bought at a price proposal that still applies: the offer price, not the SKU price.
  bool get hasAppliedOffer => unitPayable != skuUnitPayable;

  factory CartLine.fromJson(Map<String, dynamic> json) {
    final product = json['product'] as Map<String, dynamic>?;
    final sku = json['sku'] as Map<String, dynamic>?;
    return CartLine(
      id: json['id'] as int,
      productName: product?['name'] as String? ?? 'Unavailable item',
      productId: product?['id'] as int?,
      thumbnailUrl: _media((product?['thumbnailUrl'] ?? sku?['imageUrl']) as String?),
      skuLabel: sku?['label'] as String? ?? '',
      quantity: json['quantity'] as int,
      unitPayable: json['unitPayable'] as num,
      skuUnitPayable: json['skuUnitPayable'] as num,
      linePayable: json['linePayable'] as num,
      availableQuantity: (json['availableQuantity'] as num?)?.toInt() ?? 0,
      status: json['status'] as String,
      proposalNotice: json['proposalNotice'] as String?,
    );
  }
}

class CartTotals {
  CartTotals({required this.itemCount, required this.listTotal, required this.payableTotal, required this.savings});
  final int itemCount;
  final num listTotal;
  final num payableTotal;
  final num savings;

  factory CartTotals.fromJson(Map<String, dynamic> json) => CartTotals(
        itemCount: (json['itemCount'] as num).toInt(),
        listTotal: json['listTotal'] as num,
        payableTotal: json['payableTotal'] as num,
        savings: json['savings'] as num,
      );
}

class Cart {
  Cart({required this.id, required this.sellerId, required this.sellerName, required this.sellerAvatarUrl, required this.lines, required this.totals, required this.canCheckout, required this.issues});
  final int id;
  final int sellerId;
  final String sellerName;
  final String? sellerAvatarUrl;
  final List<CartLine> lines;
  final CartTotals totals;
  final bool canCheckout;
  final List<String> issues;

  factory Cart.fromJson(Map<String, dynamic> json) {
    final seller = json['seller'] as Map<String, dynamic>;
    return Cart(
      id: json['id'] as int,
      sellerId: seller['id'] as int,
      sellerName: seller['name'] as String,
      sellerAvatarUrl: _media(seller['avatarUrl'] as String?),
      lines: (json['lines'] as List).cast<Map<String, dynamic>>().map(CartLine.fromJson).toList(),
      totals: CartTotals.fromJson(json['totals'] as Map<String, dynamic>),
      canCheckout: json['canCheckout'] as bool,
      issues: (json['issues'] as List?)?.cast<String>() ?? const [],
    );
  }
}

class CartSummary {
  CartSummary({required this.cartCount, required this.itemCount});
  final int cartCount;
  final int itemCount;

  factory CartSummary.fromJson(Map<String, dynamic> json) => CartSummary(cartCount: json['cartCount'] as int, itemCount: json['itemCount'] as int);
}
