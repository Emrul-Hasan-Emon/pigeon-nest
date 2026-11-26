import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/paging/page_list_controller.dart' as paging;
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../../catalog/data/storefront_api.dart';
import '../../catalog/data/storefront_models.dart';

class SellersScreen extends ConsumerStatefulWidget {
  const SellersScreen({super.key});

  @override
  ConsumerState<SellersScreen> createState() => _SellersScreenState();
}

class _SellersScreenState extends ConsumerState<SellersScreen> {
  String _search = '';
  late paging.PageListController<SellerCard> _list;

  @override
  void initState() {
    super.initState();
    _build();
  }

  void _build() {
    _list = paging.PageListController<SellerCard>((page) async {
      final result = await ref.read(storefrontApiProvider).sellers(search: _search, page: page);
      return paging.PagedResult(items: result.results, page: result.page, totalPages: result.totalPages);
    })
      ..loadFirst();
  }

  @override
  void dispose() {
    _list.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Sellers')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(AppSpacing.m),
            child: TextField(
              decoration: const InputDecoration(hintText: 'Search sellers', prefixIcon: Icon(Icons.search), isDense: true),
              onSubmitted: (v) => setState(() {
                _search = v;
                _list.dispose();
                _build();
              }),
            ),
          ),
          Expanded(
            child: ListenableBuilder(
              listenable: _list,
              builder: (context, _) {
                if (_list.loading && _list.items.isEmpty) return const LoadingView();
                if (_list.error != null && _list.items.isEmpty) return ErrorView(message: _list.error!, onRetry: _list.loadFirst);
                if (_list.items.isEmpty) return const EmptyView(message: 'No sellers found.', icon: Icons.storefront_outlined);
                return NotificationListener<ScrollNotification>(
                  onNotification: (n) {
                    if (n.metrics.pixels > n.metrics.maxScrollExtent - 300) _list.loadMore();
                    return false;
                  },
                  child: RefreshIndicator(
                    onRefresh: _list.loadFirst,
                    child: ListView.separated(
                      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m),
                      itemCount: _list.items.length + (_list.loadingMore ? 1 : 0),
                      separatorBuilder: (_, _) => const Divider(height: 1),
                      itemBuilder: (_, i) {
                        if (i >= _list.items.length) return const Padding(padding: EdgeInsets.all(AppSpacing.m), child: Center(child: CircularProgressIndicator()));
                        final s = _list.items[i];
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: CircleAvatar(backgroundImage: s.avatarUrl != null ? NetworkImage(s.avatarUrl!) : null, child: s.avatarUrl == null ? Text(s.name[0].toUpperCase()) : null),
                          title: Text(s.name),
                          subtitle: Text('${s.productCount} birds'),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () => context.push('/sellers/${s.id}'),
                        );
                      },
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
