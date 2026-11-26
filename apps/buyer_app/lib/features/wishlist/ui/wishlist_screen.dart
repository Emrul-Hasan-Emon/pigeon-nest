import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/format/money.dart';
import '../../../shared/paging/cursor_list_controller.dart' as paging;
import '../../../shared/widgets/catalogue_plate.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../data/wishlist_api.dart';
import '../data/wishlist_models.dart';
import '../state/wishlist_ids_controller.dart';

class WishlistScreen extends ConsumerStatefulWidget {
  const WishlistScreen({super.key});

  @override
  ConsumerState<WishlistScreen> createState() => _WishlistScreenState();
}

class _WishlistScreenState extends ConsumerState<WishlistScreen> {
  late final _list = paging.CursorListController<WishlistItem>((cursor) async {
    final page = await ref.read(wishlistApiProvider).list(cursor: cursor == null ? null : int.parse(cursor));
    return paging.CursorResult(items: page.results, nextCursor: page.nextCursor?.toString());
  })
    ..loadFirst();

  @override
  void dispose() {
    _list.dispose();
    super.dispose();
  }

  Future<void> _remove(WishlistItem item) async {
    await ref.read(wishlistIdsProvider.notifier).toggle(item.productId);
    await _list.loadFirst();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Wishlist')),
      body: ListenableBuilder(
        listenable: _list,
        builder: (context, _) {
          if (_list.loading && _list.items.isEmpty) return const LoadingView();
          if (_list.error != null && _list.items.isEmpty) return ErrorView(message: _list.error!, onRetry: _list.loadFirst);
          if (_list.items.isEmpty) return const EmptyView(message: 'Nothing saved yet.', icon: Icons.favorite_border);
          return NotificationListener<ScrollNotification>(
            onNotification: (n) {
              if (n.metrics.pixels > n.metrics.maxScrollExtent - 300) _list.loadMore();
              return false;
            },
            child: RefreshIndicator(
              onRefresh: _list.loadFirst,
              child: ListView.separated(
                padding: const EdgeInsets.all(AppSpacing.m),
                itemCount: _list.items.length + (_list.loadingMore ? 1 : 0),
                separatorBuilder: (_, _) => const Divider(height: AppSpacing.l),
                itemBuilder: (_, i) {
                  if (i >= _list.items.length) return const Padding(padding: EdgeInsets.all(AppSpacing.m), child: Center(child: CircularProgressIndicator()));
                  final item = _list.items[i];
                  return _Row(item: item, onRemove: () => _remove(item));
                },
              ),
            ),
          );
        },
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.item, required this.onRemove});
  final WishlistItem item;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: item.name == null ? null : () => context.push('/products/${item.productId}'),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 64,
            child: CataloguePlate(
              child: item.thumbnailUrl != null ? Image.network(item.thumbnailUrl!, fit: BoxFit.cover) : Container(color: AppTheme.dove, child: const Icon(Icons.image_outlined, color: AppTheme.slate)),
            ),
          ),
          const SizedBox(width: AppSpacing.m),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.name ?? 'No longer listed', style: const TextStyle(fontWeight: FontWeight.w600)),
                if (item.sellerName != null) Text(item.sellerName!, style: const TextStyle(color: AppTheme.slate, fontSize: 12)),
                const SizedBox(height: 4),
                if (item.price != null) Text(formatUsd(item.price!), style: const TextStyle(fontWeight: FontWeight.w700)),
                if (!item.isAvailable) Text(_availabilityText(item.availability), style: const TextStyle(color: AppTheme.danger, fontSize: 12)),
              ],
            ),
          ),
          IconButton(icon: const Icon(Icons.favorite, color: AppTheme.danger), onPressed: onRemove),
        ],
      ),
    );
  }

  String _availabilityText(String a) => switch (a) {
        'out_of_stock' => 'Out of stock',
        'removed' => 'Removed by the seller',
        _ => 'No longer available',
      };
}
