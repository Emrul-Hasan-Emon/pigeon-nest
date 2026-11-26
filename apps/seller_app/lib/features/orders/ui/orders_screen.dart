import '../../../shared/state/list_refresh.dart';
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/format/date_format.dart';
import '../../../shared/format/money.dart';
import '../../../shared/paging/cursor_list_controller.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../../../shared/widgets/status_badge.dart';
import '../data/order_models.dart';
import '../data/order_api.dart';
import 'order_ui.dart';
import '../../../shared/widgets/image_thumb.dart';
import '../../../shared/format/text.dart';

/// The Orders tab: search, filters, endless scrolling, and long-press to move many orders at once.
class OrdersScreen extends ConsumerStatefulWidget {
  const OrdersScreen({super.key});

  @override
  ConsumerState<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends ConsumerState<OrdersScreen> {
  OrderFilter _filter = const OrderFilter();
  late CursorListController<OrderRow> _list;
  final _scroll = ScrollController();
  final _search = TextEditingController();
  Timer? _debounce;
  final _selected = <int>{};

  @override
  void initState() {
    super.initState();
    _list = _newList()..loadFirst();
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 300) _list.loadMore();
    });
  }

  CursorListController<OrderRow> _newList() => CursorListController(ref.read(orderRepositoryProvider).listFetcher(_filter));

  void _reload() {
    _list.dispose();
    _selected.clear();
    setState(() => _list = _newList()..loadFirst());
  }

  void _apply(OrderFilter f) {
    _filter = f;
    _reload();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _scroll.dispose();
    _search.dispose();
    _list.dispose();
    super.dispose();
  }

  List<OrderRow> get _selectedRows => _list.items.where((o) => _selected.contains(o.id)).toList();

  void _toggle(OrderRow o) {
    setState(() {
      if (_selected.contains(o.id)) {
        _selected.remove(o.id);
      } else if (_selected.isEmpty || _selectedRows.first.status == o.status) {
        _selected.add(o.id);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Pick orders that are at the same step.')));
      }
    });
  }

  Future<void> _bulk(String status) async {
    final noteController = TextEditingController();
    final count = _selected.length;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('${moveLabel(status)}: $count ${count == 1 ? 'order' : 'orders'}'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          if (status == 'cancelled') const Text('Cancelling returns the stock and cannot be undone by you.'),
          TextField(controller: noteController, maxLength: 500, decoration: const InputDecoration(labelText: 'Note for the customer (optional)')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Back')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(minimumSize: const Size(120, 48)),
            child: const Text('Update'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      final r = await ref.read(orderRepositoryProvider).bulkStatus(_selected.toList(), status, note: noteController.text);
      if (!mounted) return;
      final text = r.failed == 0 ? '${r.updated} updated' : '${r.updated} updated, ${r.failed} failed: ${r.errors.join('; ')}';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
    _reload();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(listRefreshProvider('orders'), (_, _) => _reload());
    final access = ref.watch(authProvider).access;
    if (access != null && !access.canManage) {
      return const EmptyView(message: 'Orders open once your shop is approved and active.', icon: Icons.receipt_long_outlined);
    }
    final picking = _selected.isNotEmpty;
    final moves = picking ? _selectedRows.first.allowedStatuses : const <String>[];
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: picking
          ? null
          : FloatingActionButton.extended(
              onPressed: () async {
                await context.push('/orders/new');
                if (mounted) _reload();
              },
              icon: const Icon(Icons.add),
              label: const Text('New order'),
            ),
      bottomNavigationBar: picking
          ? SafeArea(
              child: Container(
                padding: const EdgeInsets.all(AppSpacing.m),
                decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: AppTheme.border))),
                child: Row(children: [
                  IconButton(onPressed: () => setState(_selected.clear), icon: const Icon(Icons.close)),
                  Expanded(child: Text('${_selected.length} selected', style: const TextStyle(fontWeight: FontWeight.w700))),
                  if (moves.isEmpty) const Text('No move possible', style: TextStyle(color: AppTheme.neutral)),
                  for (final m in moves)
                    Padding(
                      padding: const EdgeInsets.only(left: AppSpacing.s),
                      child: FilledButton(
                        onPressed: () => _bulk(m),
                        style: FilledButton.styleFrom(minimumSize: const Size(0, 48), backgroundColor: m == 'cancelled' ? AppTheme.danger : null),
                        child: Text(moveLabel(m)),
                      ),
                    ),
                ]),
              ),
            )
          : null,
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(AppSpacing.m, AppSpacing.m, AppSpacing.m, AppSpacing.s),
          child: TextField(
            controller: _search,
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              hintText: 'Order number, name, phone or email',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: _search.text.isEmpty
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.clear),
                      onPressed: () {
                        _search.clear();
                        _apply(_filter.copyWith(search: ''));
                      },
                    ),
            ),
            onChanged: (v) {
              _debounce?.cancel();
              _debounce = Timer(const Duration(milliseconds: 500), () => _apply(_filter.copyWith(search: v)));
              setState(() {});
            },
          ),
        ),
        SizedBox(
          height: 44,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m),
            children: [
              _Chip('All', _filter.status == null, () => _apply(_filter.copyWith(clearStatus: true))),
              for (final s in orderStatuses) _Chip(statusLabel(s), _filter.status == s, () => _apply(_filter.copyWith(status: s))),
            ],
          ),
        ),
        SizedBox(
          height: 44,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m),
            children: [
              _Chip('Any payment', _filter.paymentStatus == null, () => _apply(_filter.copyWith(clearPayment: true))),
              for (final s in paymentStatuses) _Chip(statusLabel(s), _filter.paymentStatus == s, () => _apply(_filter.copyWith(paymentStatus: s))),
            ],
          ),
        ),
        Expanded(
          child: ListenableBuilder(
            listenable: _list,
            builder: (context, _) {
              if (_list.loading && _list.items.isEmpty) return const LoadingView();
              if (_list.error != null && _list.items.isEmpty) return ErrorView(message: _list.error!, onRetry: _reload);
              if (_list.items.isEmpty) return const EmptyView(message: 'No orders match.', icon: Icons.receipt_long_outlined);
              return RefreshIndicator(
                onRefresh: () async => _reload(),
                child: ListView.separated(
                  controller: _scroll,
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(AppSpacing.m, AppSpacing.s, AppSpacing.m, 96),
                  itemCount: _list.items.length + (_list.hasMore ? 1 : 0),
                  separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.s),
                  itemBuilder: (_, i) {
                    if (i >= _list.items.length) return const Padding(padding: EdgeInsets.all(AppSpacing.m), child: Center(child: CircularProgressIndicator()));
                    final o = _list.items[i];
                    return _OrderTile(
                      o,
                      selected: _selected.contains(o.id),
                      picking: picking,
                      onTap: () async {
                        if (picking) return _toggle(o);
                        await context.push('/orders/${o.id}');
                        if (mounted) _reload();
                      },
                      onLongPress: () => _toggle(o),
                    );
                  },
                ),
              );
            },
          ),
        ),
      ]),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip(this.label, this.selected, this.onTap);
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(right: AppSpacing.s),
        child: ChoiceChip(label: Text(label), selected: selected, onSelected: (_) => onTap()),
      );
}

class _OrderTile extends StatelessWidget {
  const _OrderTile(this.o, {required this.selected, required this.picking, required this.onTap, required this.onLongPress});
  final OrderRow o;
  final bool selected, picking;
  final VoidCallback onTap, onLongPress;

  @override
  Widget build(BuildContext context) => GestureDetector(
        onLongPress: onLongPress,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: selected ? AppTheme.ink : Colors.transparent, width: 2),
          ),
          child: AppCard(
            onTap: onTap,
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (picking) Padding(padding: const EdgeInsets.only(right: AppSpacing.s), child: Icon(selected ? Icons.check_circle : Icons.circle_outlined)),
              ImageThumb(o.previewImage),
              const SizedBox(width: AppSpacing.m),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(o.orderNumber, style: const TextStyle(fontWeight: FontWeight.w700)),
                  Text(
                    '${o.customer.name} · ${o.itemCount} ${o.itemCount == 1 ? 'item' : 'items'}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: AppTheme.neutral),
                  ),
                  Text(formatDate(o.createdAt), style: const TextStyle(color: AppTheme.neutral, fontSize: 12)),
                  const SizedBox(height: AppSpacing.s),
                  Wrap(spacing: AppSpacing.xs, runSpacing: AppSpacing.xs, children: [
                    StatusBadge(label: statusLabel(o.status), tone: orderTone(o.status)),
                    StatusBadge(label: statusLabel(o.paymentStatus), tone: paymentTone(o.paymentStatus)),
                  ]),
                ]),
              ),
              Text(formatUsd(o.payable), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            ]),
          ),
        ),
      );
}
