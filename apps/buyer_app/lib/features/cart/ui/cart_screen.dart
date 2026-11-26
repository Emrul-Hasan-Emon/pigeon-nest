import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/format/money.dart';
import '../../../shared/widgets/catalogue_plate.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../data/cart_models.dart';
import '../state/carts_controller.dart';

/// Cart tab: one card per seller, since checkout happens one seller at a time.
class CartScreen extends ConsumerWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(cartsProvider);
    return async.when(
      loading: () => const LoadingView(),
      error: (e, _) => ErrorView(message: 'Could not load your cart.', onRetry: () => ref.read(cartsProvider.notifier).reload()),
      data: (carts) {
        if (carts.isEmpty) return const EmptyView(message: 'Your cart is empty.', icon: Icons.shopping_bag_outlined);
        return RefreshIndicator(
          onRefresh: () => ref.read(cartsProvider.notifier).reload(),
          child: ListView.separated(
            padding: const EdgeInsets.all(AppSpacing.m),
            itemCount: carts.length,
            separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.m),
            itemBuilder: (_, i) => _SellerCart(cart: carts[i]),
          ),
        );
      },
    );
  }
}

class _SellerCart extends ConsumerWidget {
  const _SellerCart({required this.cart});
  final Cart cart;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.m),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 16,
                  backgroundImage: cart.sellerAvatarUrl != null ? NetworkImage(cart.sellerAvatarUrl!) : null,
                  child: cart.sellerAvatarUrl == null ? Text(cart.sellerName[0].toUpperCase()) : null,
                ),
                const SizedBox(width: AppSpacing.s),
                Expanded(child: Text(cart.sellerName, style: const TextStyle(fontWeight: FontWeight.w600))),
                TextButton(
                  onPressed: () => showDialog<void>(
                    context: context,
                    builder: (dialogContext) => AlertDialog(
                      title: const Text('Empty this cart?'),
                      content: Text('Removes everything from ${cart.sellerName}.'),
                      actions: [
                        TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Cancel')),
                        TextButton(
                          onPressed: () {
                            Navigator.pop(dialogContext);
                            ref.read(cartsProvider.notifier).clear(cart.id);
                          },
                          child: const Text('Empty'),
                        ),
                      ],
                    ),
                  ),
                  child: const Text('Empty'),
                ),
              ],
            ),
            const Divider(),
            for (final line in cart.lines) _CartLineTile(cartId: cart.id, line: line),
            if (cart.issues.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.s),
                child: Text(cart.issues.join(' '), style: const TextStyle(color: AppTheme.danger, fontSize: 12)),
              ),
            const Divider(),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('${cart.totals.itemCount} item(s)', style: const TextStyle(color: AppTheme.slate)),
                Text(formatUsd(cart.totals.payableTotal), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              ],
            ),
            const SizedBox(height: AppSpacing.s),
            FilledButton(
              onPressed: cart.canCheckout ? () => context.push('/checkout/${cart.id}') : null,
              child: const Text('Checkout'),
            ),
          ],
        ),
      ),
    );
  }
}

class _CartLineTile extends ConsumerWidget {
  const _CartLineTile({required this.cartId, required this.line});
  final int cartId;
  final CartLine line;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifier = ref.read(cartsProvider.notifier);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.s),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 56,
            child: CataloguePlate(
              child: line.thumbnailUrl != null
                  ? Image.network(line.thumbnailUrl!, fit: BoxFit.cover)
                  : Container(color: AppTheme.dove, child: const Icon(Icons.image_outlined, size: 18, color: AppTheme.slate)),
            ),
          ),
          const SizedBox(width: AppSpacing.s),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(line.productName, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
                if (line.skuLabel.isNotEmpty) Text(line.skuLabel, style: const TextStyle(color: AppTheme.slate, fontSize: 12)),
                if (!line.isOk) Text(_statusText(line.status), style: const TextStyle(color: AppTheme.danger, fontSize: 12)),
                if (line.hasAppliedOffer) const Text('Offer price applied', style: TextStyle(color: AppTheme.teal, fontSize: 12)),
                Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.remove_circle_outline, size: 20),
                      onPressed: line.quantity > 1 ? () => notifier.setQuantity(cartId, line.id, line.quantity - 1) : null,
                    ),
                    Text('${line.quantity}'),
                    IconButton(
                      icon: const Icon(Icons.add_circle_outline, size: 20),
                      onPressed: line.quantity < line.availableQuantity ? () => notifier.setQuantity(cartId, line.id, line.quantity + 1) : null,
                    ),
                    const Spacer(),
                    Text(formatUsd(line.linePayable), style: const TextStyle(fontWeight: FontWeight.w600)),
                  ],
                ),
              ],
            ),
          ),
          IconButton(icon: const Icon(Icons.close, size: 18), onPressed: () => notifier.removeItem(cartId, line.id)),
        ],
      ),
    );
  }

  String _statusText(String status) => switch (status) {
        'unavailable' => 'No longer available',
        'out_of_stock' => 'Out of stock',
        'insufficient_stock' => 'Not enough stock',
        _ => status,
      };
}
