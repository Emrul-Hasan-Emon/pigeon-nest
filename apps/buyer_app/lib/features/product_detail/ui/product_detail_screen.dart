import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/format/money.dart';
import '../../../shared/widgets/catalogue_plate.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../../../shared/widgets/primary_button.dart';
import '../../cart/state/carts_controller.dart';
import '../../offers/data/proposal_api.dart';
import '../../questions/ui/questions_section.dart';
import '../../reviews/ui/reviews_section.dart';
import '../../wishlist/widgets/wishlist_heart.dart';
import '../../catalog/data/storefront_api.dart';
import '../../catalog/data/storefront_models.dart';
import '../../catalog/widgets/product_tile.dart';

final productDetailProvider = FutureProvider.family<ProductDetail, int>((ref, id) => ref.read(storefrontApiProvider).product(id));

class ProductDetailScreen extends ConsumerWidget {
  const ProductDetailScreen({super.key, required this.id});
  final int id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(productDetailProvider(id));
    return Scaffold(
      appBar: AppBar(title: Text(async.asData?.value.name ?? 'Bird')),
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: 'Could not load this bird.', onRetry: () => ref.invalidate(productDetailProvider(id))),
        data: (product) => _Detail(product: product),
      ),
    );
  }
}

class _Detail extends ConsumerStatefulWidget {
  const _Detail({required this.product});
  final ProductDetail product;

  @override
  ConsumerState<_Detail> createState() => _DetailState();
}

class _DetailState extends ConsumerState<_Detail> {
  late ProductSku _sku = widget.product.skus.firstWhere((s) => s.isDefault, orElse: () => widget.product.skus.first);
  final _gallery = PageController();
  int _quantity = 1;
  bool _adding = false;

  void _pick(int attributeId, int valueId) {
    final selected = Map<int, int>.fromEntries(widget.product.options.map((o) => MapEntry(o.attributeId, _sku.valueFor(o.attributeId) ?? -1)));
    selected[attributeId] = valueId;
    final match = widget.product.skus.where((s) => selected.entries.every((e) => s.valueFor(e.key) == e.value)).firstOrNull;
    if (match != null) {
      setState(() {
        _sku = match;
        _quantity = 1;
      });
    }
  }

  Future<void> _addToCart() async {
    setState(() => _adding = true);
    try {
      await ref.read(cartsProvider.notifier).addItem(sellerProductId: widget.product.id, sellerProductSkuId: _sku.id, quantity: _quantity);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Added to cart')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not add to cart: $e')));
    } finally {
      if (mounted) setState(() => _adding = false);
    }
  }

  Future<void> _makeOffer() async {
    if (ref.read(authProvider).status != AuthStatus.signedIn) {
      context.push('/login');
      return;
    }
    final result = await showDialog<Map<String, String>>(
      context: context,
      builder: (dialogContext) {
        final price = TextEditingController();
        final qty = TextEditingController(text: '$_quantity');
        return AlertDialog(
          title: const Text('Propose a price'),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(controller: price, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Your price per unit')),
            TextField(controller: qty, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Quantity')),
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(dialogContext, {'price': price.text, 'quantity': qty.text}), child: const Text('Send offer')),
          ],
        );
      },
    );
    if (result == null) return;
    final price = num.tryParse(result['price'] ?? '');
    final quantity = int.tryParse(result['quantity'] ?? '');
    if (price == null || quantity == null) return;
    try {
      await ref.read(proposalApiProvider).create(sellerProductSkuId: _sku.id, quantity: quantity, price: price);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Offer sent')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not send offer: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.product;
    final media = p.media.isNotEmpty ? p.media : (_sku.imageUrl != null ? [ProductMedia(id: 0, url: _sku.imageUrl!, isPrimary: true)] : <ProductMedia>[]);
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.m),
      children: [
        if (p.breadcrumb.isNotEmpty)
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              for (var i = 0; i < p.breadcrumb.length; i++) ...[
                if (i > 0) const Padding(padding: EdgeInsets.symmetric(horizontal: 4), child: Icon(Icons.chevron_right, size: 16, color: AppTheme.slate)),
                GestureDetector(onTap: () => context.push('/categories/${p.breadcrumb[i].slug}'), child: Text(p.breadcrumb[i].name, style: const TextStyle(color: AppTheme.slate, fontSize: 12))),
              ],
            ],
          ),
        const SizedBox(height: AppSpacing.m),
        CataloguePlate(
          aspectRatio: 1,
          child: media.isEmpty
              ? Container(color: AppTheme.dove, child: const Icon(Icons.image_outlined, size: 48, color: AppTheme.slate))
              : PageView(controller: _gallery, children: [for (final m in media) Image.network(m.url, fit: BoxFit.cover)]),
        ),
        if (media.length > 1)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.s),
            child: SizedBox(
              height: 56,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: media.length,
                separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.s),
                itemBuilder: (_, i) => GestureDetector(
                  onTap: () => _gallery.jumpToPage(i),
                  child: SizedBox(width: 56, child: CataloguePlate(child: Image.network(media[i].url, fit: BoxFit.cover))),
                ),
              ),
            ),
          ),
        const SizedBox(height: AppSpacing.m),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: Text(p.name, style: Theme.of(context).textTheme.headlineSmall)),
            WishlistHeart(productId: p.id),
          ],
        ),
        if (p.breed != null || p.bloodline != null)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text([p.breed, p.bloodline].whereType<String>().join(' · '), style: const TextStyle(color: AppTheme.slate)),
          ),
        const SizedBox(height: AppSpacing.s),
        Row(
          children: [
            Text(formatUsd(_sku.effectivePrice), style: Theme.of(context).textTheme.titleLarge),
            if (_sku.discountedPrice != null) ...[
              const SizedBox(width: 8),
              Text(formatUsd(_sku.price), style: const TextStyle(decoration: TextDecoration.lineThrough, color: AppTheme.slate)),
            ],
            const Spacer(),
            Text(_sku.inStock ? 'In stock' : 'Out of stock', style: TextStyle(color: _sku.inStock ? AppTheme.success : AppTheme.danger, fontWeight: FontWeight.w600)),
          ],
        ),
        if (p.ratingCount > 0)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Row(children: [const Icon(Icons.star, size: 16, color: AppTheme.brass), const SizedBox(width: 2), Text('${p.ratingAverage.toStringAsFixed(1)} (${p.ratingCount} reviews)', style: const TextStyle(color: AppTheme.slate, fontSize: 12))]),
          ),
        for (final option in p.options) ...[
          const SizedBox(height: AppSpacing.m),
          Text(option.name, style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: AppSpacing.xs),
          Wrap(
            spacing: AppSpacing.s,
            children: [
              for (final v in option.values)
                ChoiceChip(label: Text(v.name), selected: _sku.valueFor(option.attributeId) == v.id, onSelected: (_) => _pick(option.attributeId, v.id)),
            ],
          ),
        ],
        if (_sku.inStock) ...[
          const SizedBox(height: AppSpacing.m),
          Row(
            children: [
              IconButton(icon: const Icon(Icons.remove_circle_outline), onPressed: _quantity > 1 ? () => setState(() => _quantity--) : null),
              Text('$_quantity', style: const TextStyle(fontWeight: FontWeight.w600)),
              IconButton(icon: const Icon(Icons.add_circle_outline), onPressed: _quantity < _sku.quantity ? () => setState(() => _quantity++) : null),
              const SizedBox(width: AppSpacing.m),
              Expanded(child: PrimaryButton(label: 'Add to cart', busy: _adding, onPressed: _addToCart)),
            ],
          ),
          if (_sku.acceptProposals) ...[
            const SizedBox(height: AppSpacing.s),
            OutlinedButton.icon(onPressed: _makeOffer, icon: const Icon(Icons.local_offer_outlined), label: const Text('Propose a price')),
          ],
        ],
        if (p.description != null) ...[
          const SizedBox(height: AppSpacing.l),
          Text('Description', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: AppSpacing.xs),
          Text(p.description!),
        ],
        const SizedBox(height: AppSpacing.l),
        GestureDetector(
          onTap: () => context.push('/sellers/${p.sellerId}'),
          child: Container(
            padding: const EdgeInsets.all(AppSpacing.m),
            decoration: BoxDecoration(
              color: AppTheme.paper,
              border: Border.all(color: AppTheme.line),
              borderRadius: BorderRadius.circular(8),
              boxShadow: [BoxShadow(color: AppTheme.ink.withValues(alpha: 0.04), blurRadius: 10, offset: const Offset(0, 3))],
            ),
            child: Row(
              children: [
                CircleAvatar(backgroundColor: AppTheme.teal, foregroundColor: Colors.white, child: Text(p.seller[0].toUpperCase())),
                const SizedBox(width: AppSpacing.m),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Sold by', style: TextStyle(color: AppTheme.slate, fontSize: 11, letterSpacing: 0.3)),
                      Text(p.seller, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                      Text('${p.sellerProductCount} birds', style: const TextStyle(color: AppTheme.slate, fontSize: 12)),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, color: AppTheme.slate),
              ],
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.l),
        ReviewsSection(productId: p.id),
        const SizedBox(height: AppSpacing.l),
        QuestionsSection(productId: p.id),
        if (p.related.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.l),
          Text('You may also like', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.s),
          SizedBox(
            height: 230,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: p.related.length,
              separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.m),
              itemBuilder: (_, i) => SizedBox(width: 150, child: ProductTile(product: p.related[i])),
            ),
          ),
        ],
      ],
    );
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
