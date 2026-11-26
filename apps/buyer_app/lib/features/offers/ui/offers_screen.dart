import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/format/money.dart';
import '../../../shared/format/text.dart';
import '../../../shared/paging/cursor_list_controller.dart' as paging;
import '../../../shared/widgets/catalogue_plate.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../../../shared/widgets/status_badge.dart';
import '../data/proposal_api.dart';
import '../data/proposal_models.dart';

StatusTone _tone(String status) => switch (status) {
      'accepted' || 'used' => StatusTone.success,
      'rejected' || 'cancelled' => StatusTone.danger,
      _ => StatusTone.warning,
    };

/// Every price offer the buyer has made, across all sellers.
class OffersScreen extends ConsumerStatefulWidget {
  const OffersScreen({super.key});

  @override
  ConsumerState<OffersScreen> createState() => _OffersScreenState();
}

class _OffersScreenState extends ConsumerState<OffersScreen> {
  late final _list = paging.CursorListController<Proposal>((cursor) async {
    final page = await ref.read(proposalApiProvider).list(cursor: cursor == null ? null : int.parse(cursor));
    return paging.CursorResult(items: page.results, nextCursor: page.nextCursor?.toString());
  })
    ..loadFirst();

  @override
  void dispose() {
    _list.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My offers')),
      body: ListenableBuilder(
        listenable: _list,
        builder: (context, _) {
          if (_list.loading && _list.items.isEmpty) return const LoadingView();
          if (_list.error != null && _list.items.isEmpty) return ErrorView(message: _list.error!, onRetry: _list.loadFirst);
          if (_list.items.isEmpty) return const EmptyView(message: 'No offers yet.', icon: Icons.local_offer_outlined);
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
                separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.s),
                itemBuilder: (_, i) {
                  if (i >= _list.items.length) return const Padding(padding: EdgeInsets.all(AppSpacing.m), child: Center(child: CircularProgressIndicator()));
                  final p = _list.items[i];
                  return Card(
                    child: ListTile(
                      onTap: () => context.push('/offers/${p.id}').then((_) => _list.loadFirst()),
                      leading: SizedBox(
                        width: 44,
                        child: CataloguePlate(child: p.productThumbnailUrl != null ? Image.network(p.productThumbnailUrl!, fit: BoxFit.cover) : Container(color: AppTheme.dove)),
                      ),
                      title: Text(p.productName, maxLines: 1, overflow: TextOverflow.ellipsis),
                      subtitle: Text('${p.sellerName} · ${p.quantity} × ${formatUsd(p.price)}', style: const TextStyle(fontSize: 12)),
                      trailing: StatusBadge(label: statusLabel(p.status), tone: _tone(p.status)),
                    ),
                  );
                },
              ),
            ),
          );
        },
      ),
    );
  }
}
