import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/format/date_format.dart';
import '../../../shared/format/money.dart';
import '../../../shared/format/text.dart';
import '../../../shared/paging/page_list_controller.dart' as paging;
import '../../../shared/widgets/catalogue_plate.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../../../shared/widgets/status_badge.dart';
import '../data/order_api.dart';
import '../data/order_models.dart';
import 'order_tone.dart';

/// Orders tab: every order the buyer placed, with status/search filters.
class OrdersScreen extends ConsumerStatefulWidget {
  const OrdersScreen({super.key});

  @override
  ConsumerState<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends ConsumerState<OrdersScreen> {
  String? _status;
  String _search = '';
  late paging.PageListController<OrderSummary> _list;
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _build();
  }

  void _build() {
    _list = paging.PageListController<OrderSummary>((page) async {
      final result = await ref.read(orderApiProvider).list(status: _status, search: _search.isEmpty ? null : _search, page: page);
      return paging.PagedResult(items: result.results, page: result.page, totalPages: result.totalPages);
    })
      ..loadFirst();
  }

  void _refilter() {
    setState(() {
      _list.dispose();
      _build();
    });
  }

  @override
  void dispose() {
    _list.dispose();
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(AppSpacing.m),
          child: Column(
            children: [
              TextField(
                controller: _searchController,
                decoration: const InputDecoration(hintText: 'Search order number', prefixIcon: Icon(Icons.search), isDense: true),
                onSubmitted: (v) {
                  _search = v;
                  _refilter();
                },
              ),
              const SizedBox(height: AppSpacing.s),
              SizedBox(
                height: 36,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    _FilterChip(label: 'All', selected: _status == null, onTap: () {
                      _status = null;
                      _refilter();
                    }),
                    for (final s in kOrderStatuses)
                      Padding(
                        padding: const EdgeInsets.only(left: AppSpacing.s),
                        child: _FilterChip(label: statusLabel(s), selected: _status == s, onTap: () {
                          _status = s;
                          _refilter();
                        }),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListenableBuilder(
            listenable: _list,
            builder: (context, _) {
              if (_list.loading && _list.items.isEmpty) return const LoadingView();
              if (_list.error != null && _list.items.isEmpty) return ErrorView(message: _list.error!, onRetry: _list.loadFirst);
              if (_list.items.isEmpty) return const EmptyView(message: 'No orders yet.', icon: Icons.receipt_long_outlined);
              return NotificationListener<ScrollNotification>(
                onNotification: (n) {
                  if (n.metrics.pixels > n.metrics.maxScrollExtent - 300) _list.loadMore();
                  return false;
                },
                child: RefreshIndicator(
                  onRefresh: _list.loadFirst,
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(AppSpacing.m, 0, AppSpacing.m, AppSpacing.m),
                    itemCount: _list.items.length + (_list.loadingMore ? 1 : 0),
                    separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.s),
                    itemBuilder: (_, i) {
                      if (i >= _list.items.length) return const Padding(padding: EdgeInsets.all(AppSpacing.m), child: Center(child: CircularProgressIndicator()));
                      return _OrderCard(order: _list.items[i]);
                    },
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => ChoiceChip(label: Text(label), selected: selected, onSelected: (_) => onTap());
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.order});
  final OrderSummary order;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: () => context.push('/orders/${order.id}'),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.m),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(child: Text('#${order.orderNumber}', style: const TextStyle(fontWeight: FontWeight.w700))),
                  StatusBadge(label: statusLabel(order.status), tone: orderStatusTone(order.status)),
                ],
              ),
              const SizedBox(height: 2),
              Text(formatDate(order.createdAt), style: const TextStyle(color: AppTheme.slate, fontSize: 12)),
              const SizedBox(height: AppSpacing.s),
              Row(
                children: [
                  for (final item in order.previewItems.take(3))
                    Padding(
                      padding: const EdgeInsets.only(right: AppSpacing.xs),
                      child: SizedBox(
                        width: 44,
                        child: CataloguePlate(
                          child: item.imageUrl != null
                              ? Image.network(item.imageUrl!, fit: BoxFit.cover)
                              : Container(color: AppTheme.dove, child: const Icon(Icons.image_outlined, size: 16, color: AppTheme.slate)),
                        ),
                      ),
                    ),
                  Expanded(child: Text('${order.sellerName} · ${order.itemCount} item(s)', style: const TextStyle(color: AppTheme.slate, fontSize: 12), overflow: TextOverflow.ellipsis)),
                ],
              ),
              const SizedBox(height: AppSpacing.s),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  StatusBadge(label: statusLabel(order.paymentStatus), tone: paymentStatusTone(order.paymentStatus)),
                  Text(formatUsd(order.payable), style: const TextStyle(fontWeight: FontWeight.w700)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
