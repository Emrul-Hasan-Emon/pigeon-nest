import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../../catalog/data/storefront_api.dart';
import '../../catalog/data/storefront_models.dart';
import '../../catalog/ui/product_list_screen.dart';

final sellerDetailProvider = FutureProvider.family<SellerDetails, int>((ref, id) => ref.read(storefrontApiProvider).seller(id));

class SellerDetailScreen extends ConsumerWidget {
  const SellerDetailScreen({super.key, required this.id});
  final int id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(sellerDetailProvider(id));
    return Scaffold(
      appBar: AppBar(title: Text(async.asData?.value.name ?? 'Seller')),
      body: async.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: 'Could not load this seller.', onRetry: () => ref.invalidate(sellerDetailProvider(id))),
        data: (seller) => ProductListScreen(
          query: ProductQuery(sellerId: seller.id),
          emptyText: 'This seller has no birds listed yet.',
          header: _Header(seller: seller),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.seller});
  final SellerDetails seller;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.m),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 32,
            backgroundImage: seller.avatarUrl != null ? NetworkImage(seller.avatarUrl!) : null,
            child: seller.avatarUrl == null ? Text(seller.name[0].toUpperCase(), style: const TextStyle(fontSize: 24)) : null,
          ),
          const SizedBox(width: AppSpacing.m),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(seller.name, style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 2),
                Row(
                  children: [
                    const Icon(Icons.star, size: 16, color: AppTheme.brass),
                    const SizedBox(width: 2),
                    Text('${seller.ratingAverage.toStringAsFixed(1)} (${seller.ratingCount})  ·  ${seller.productCount} birds', style: const TextStyle(color: AppTheme.slate, fontSize: 12)),
                  ],
                ),
                if (seller.description != null) ...[
                  const SizedBox(height: AppSpacing.s),
                  Text(seller.description!),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
