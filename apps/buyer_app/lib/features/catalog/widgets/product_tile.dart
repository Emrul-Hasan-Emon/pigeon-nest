import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/format/money.dart';
import '../../../shared/widgets/catalogue_plate.dart';
import '../../../shared/widgets/lot_badge.dart';
import '../../wishlist/widgets/wishlist_heart.dart';
import '../data/storefront_models.dart';

/// A product as a catalogue lot: plate photo, honest position number, name,
/// breed/bloodline mark, price. The one tile every product grid uses.
class ProductTile extends StatelessWidget {
  const ProductTile({super.key, required this.product, this.lot});

  final StoreProduct product;
  final int? lot;

  @override
  Widget build(BuildContext context) {
    final price = product.effectivePrice;
    final onSale = product.discountedPrice != null && product.price != null && product.discountedPrice! < product.price!;
    return GestureDetector(
      onTap: () => context.push('/products/${product.id}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Stack(
            children: [
              CataloguePlate(
                child: product.thumbnailUrl != null
                    ? Image.network(product.thumbnailUrl!, fit: BoxFit.cover)
                    : Container(color: AppTheme.dove, child: const Icon(Icons.image_outlined, color: AppTheme.slate)),
              ),
              if (lot != null) Positioned(left: 6, top: 6, child: LotBadge(number: lot!)),
              Positioned(right: 6, top: 6, child: WishlistHeart(productId: product.id, size: 16)),
            ],
          ),
          const SizedBox(height: AppSpacing.s),
          Text(product.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.titleSmall),
          if (product.breed != null || product.bloodline != null)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                [product.breed, product.bloodline].whereType<String>().join(' · '),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 11, color: AppTheme.slate, letterSpacing: 0.4),
              ),
            ),
          const SizedBox(height: 4),
          if (price != null)
            Row(
              children: [
                Text(formatUsd(price), style: const TextStyle(fontWeight: FontWeight.w700, color: AppTheme.ink)),
                if (onSale) ...[
                  const SizedBox(width: 6),
                  Text(formatUsd(product.price!), style: const TextStyle(decoration: TextDecoration.lineThrough, color: AppTheme.slate, fontSize: 12)),
                ],
                if (onSale) ...[
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                    decoration: BoxDecoration(color: AppTheme.brass.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(4)),
                    child: const Text('SALE', style: TextStyle(color: AppTheme.brass, fontSize: 9, fontWeight: FontWeight.w700, letterSpacing: 0.5)),
                  ),
                ],
              ],
            ),
        ],
      ),
    );
  }
}

/// A 2-column product grid with the catalogue's real position numbers,
/// carried over from [startIndex] (a page offset).
class ProductGrid extends StatelessWidget {
  const ProductGrid({super.key, required this.products, this.startIndex = 0, this.padding});

  final List<StoreProduct> products;
  final int startIndex;
  final EdgeInsets? padding;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      padding: padding ?? const EdgeInsets.all(AppSpacing.m),
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: products.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: AppSpacing.m, crossAxisSpacing: AppSpacing.m, childAspectRatio: 0.68),
      itemBuilder: (_, i) => ProductTile(product: products[i], lot: startIndex + i + 1),
    );
  }
}
