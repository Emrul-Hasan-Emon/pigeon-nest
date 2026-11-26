import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/format/money.dart';
import '../../../shared/format/text.dart';
import '../../../shared/paging/page_list_controller.dart' as paging;
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../../../shared/widgets/status_badge.dart';
import '../data/return_api.dart';
import '../data/return_models.dart';

StatusTone _tone(String status) => switch (status) {
      'returned' || 'accepted' => StatusTone.success,
      'rejected' || 'cancelled' => StatusTone.danger,
      'returning_money' || 'processing' => StatusTone.info,
      _ => StatusTone.warning,
    };

class ReturnsScreen extends ConsumerStatefulWidget {
  const ReturnsScreen({super.key});

  @override
  ConsumerState<ReturnsScreen> createState() => _ReturnsScreenState();
}

class _ReturnsScreenState extends ConsumerState<ReturnsScreen> {
  late final _list = paging.PageListController<ReturnSummary>((page) async {
    final result = await ref.read(returnApiProvider).list(page: page);
    return paging.PagedResult(items: result.results, page: result.page, totalPages: result.totalPages);
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
      appBar: AppBar(title: const Text('Returns')),
      body: ListenableBuilder(
        listenable: _list,
        builder: (context, _) {
          if (_list.loading && _list.items.isEmpty) return const LoadingView();
          if (_list.error != null && _list.items.isEmpty) return ErrorView(message: _list.error!, onRetry: _list.loadFirst);
          if (_list.items.isEmpty) return const EmptyView(message: 'No returns yet.', icon: Icons.assignment_return_outlined);
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
                separatorBuilder: (_, _) => const Divider(),
                itemBuilder: (_, i) {
                  if (i >= _list.items.length) return const Padding(padding: EdgeInsets.all(AppSpacing.m), child: Center(child: CircularProgressIndicator()));
                  final r = _list.items[i];
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    onTap: () => context.push('/returns/${r.id}').then((_) => _list.loadFirst()),
                    title: Text('#${r.returnNumber}'),
                    subtitle: Text('Order #${r.orderNumber ?? '—'} · ${r.itemCount} item(s)', style: const TextStyle(fontSize: 12)),
                    trailing: Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, children: [
                      StatusBadge(label: statusLabel(r.status), tone: _tone(r.status)),
                      const SizedBox(height: 4),
                      Text(formatUsd(r.refundAmount), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12)),
                    ]),
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
