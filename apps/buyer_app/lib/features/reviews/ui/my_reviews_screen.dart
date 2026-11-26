import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/paging/cursor_list_controller.dart' as paging;
import '../../../shared/widgets/catalogue_plate.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../data/review_api.dart';
import '../data/review_models.dart';
import 'write_review_sheet.dart';

/// Delivered items waiting for a review, and the buyer's own reviews
/// (editable within their window).
class MyReviewsScreen extends ConsumerStatefulWidget {
  const MyReviewsScreen({super.key});

  @override
  ConsumerState<MyReviewsScreen> createState() => _MyReviewsScreenState();
}

class _MyReviewsScreenState extends ConsumerState<MyReviewsScreen> with SingleTickerProviderStateMixin {
  late final _tabs = TabController(length: 2, vsync: this);
  late final _pending = paging.CursorListController<PendingReviewItem>((cursor) async {
    final page = await ref.read(reviewApiProvider).pending(cursor: cursor == null ? null : int.parse(cursor));
    return paging.CursorResult(items: page.results, nextCursor: page.nextCursor?.toString());
  })
    ..loadFirst();
  late final _mine = paging.CursorListController<MyReview>((cursor) async {
    final page = await ref.read(reviewApiProvider).mine(cursor: cursor == null ? null : int.parse(cursor));
    return paging.CursorResult(items: page.results, nextCursor: page.nextCursor?.toString());
  })
    ..loadFirst();

  Future<void> _write(PendingReviewItem item) async {
    final saved = await showModalBottomSheet<bool>(context: context, isScrollControlled: true, showDragHandle: true, builder: (_) => WriteReviewSheet(orderItemId: item.id));
    if (saved == true) {
      _pending.loadFirst();
      _mine.loadFirst();
    }
  }

  Future<void> _edit(MyReview review) async {
    final saved = await showModalBottomSheet<bool>(context: context, isScrollControlled: true, showDragHandle: true, builder: (_) => WriteReviewSheet(existing: review));
    if (saved == true) _mine.loadFirst();
  }

  @override
  void dispose() {
    _tabs.dispose();
    _pending.dispose();
    _mine.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My reviews'), bottom: TabBar(controller: _tabs, tabs: const [Tab(text: 'To review'), Tab(text: 'Written')])),
      body: TabBarView(
        controller: _tabs,
        children: [
          ListenableBuilder(
            listenable: _pending,
            builder: (context, _) {
              if (_pending.loading && _pending.items.isEmpty) return const LoadingView();
              if (_pending.items.isEmpty) return const EmptyView(message: 'Nothing to review yet.', icon: Icons.rate_review_outlined);
              return ListView.separated(
                padding: const EdgeInsets.all(AppSpacing.m),
                itemCount: _pending.items.length,
                separatorBuilder: (_, _) => const Divider(),
                itemBuilder: (_, i) {
                  final item = _pending.items[i];
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: SizedBox(width: 44, child: CataloguePlate(child: item.thumbnailUrl != null ? Image.network(item.thumbnailUrl!, fit: BoxFit.cover) : Container(color: AppTheme.dove))),
                    title: Text(item.productName, maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: Text('Order #${item.orderNumber}', style: const TextStyle(fontSize: 12)),
                    trailing: FilledButton(onPressed: () => _write(item), child: const Text('Review')),
                  );
                },
              );
            },
          ),
          ListenableBuilder(
            listenable: _mine,
            builder: (context, _) {
              if (_mine.loading && _mine.items.isEmpty) return const LoadingView();
              if (_mine.items.isEmpty) return const EmptyView(message: 'No reviews written yet.', icon: Icons.rate_review_outlined);
              return ListView.separated(
                padding: const EdgeInsets.all(AppSpacing.m),
                itemCount: _mine.items.length,
                separatorBuilder: (_, _) => const Divider(),
                itemBuilder: (_, i) {
                  final r = _mine.items[i];
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: SizedBox(width: 44, child: CataloguePlate(child: r.productThumbnailUrl != null ? Image.network(r.productThumbnailUrl!, fit: BoxFit.cover) : Container(color: AppTheme.dove))),
                    title: Text(r.productName ?? 'Product removed', maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: Row(children: [
                      Row(children: List.generate(5, (i) => Icon(i < r.rating ? Icons.star : Icons.star_border, size: 12, color: AppTheme.brass))),
                      if (r.status == 'hidden') const Padding(padding: EdgeInsets.only(left: 6), child: Text('Hidden', style: TextStyle(color: AppTheme.danger, fontSize: 11))),
                    ]),
                    trailing: r.canEdit ? TextButton(onPressed: () => _edit(r), child: const Text('Edit')) : null,
                  );
                },
              );
            },
          ),
        ],
      ),
    );
  }
}
