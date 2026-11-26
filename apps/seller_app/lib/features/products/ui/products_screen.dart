import '../../../shared/state/list_refresh.dart';
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/auth/auth_controller.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/paging/cursor_list_controller.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../../../shared/widgets/status_badge.dart';
import '../data/product_models.dart';
import '../data/product_api.dart';
import '../../../shared/widgets/image_thumb.dart';

StatusTone reviewTone(String s) => switch (s) {
      'approved' => StatusTone.success,
      'rejected' => StatusTone.danger,
      _ => StatusTone.warning,
    };

StatusTone activityTone(String s) => switch (s) {
      'active' => StatusTone.success,
      'suspended' => StatusTone.danger,
      _ => StatusTone.neutral,
    };

/// The Products tab: search, filters, endless scrolling, copy, on/off, and bulk actions.
class ProductsScreen extends ConsumerStatefulWidget {
  const ProductsScreen({super.key});

  @override
  ConsumerState<ProductsScreen> createState() => _ProductsScreenState();
}

class _ProductsScreenState extends ConsumerState<ProductsScreen> {
  ProductFilter _filter = const ProductFilter();
  late CursorListController<ProductRow> _list;
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

  CursorListController<ProductRow> _newList() => CursorListController(ref.read(productRepositoryProvider).listFetcher(_filter));

  void _reload() {
    _list.dispose();
    _selected.clear();
    setState(() => _list = _newList()..loadFirst());
  }

  void _apply(ProductFilter f) {
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

  void _say(String text) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

  Future<void> _open(String path) async {
    await context.push(path);
    if (mounted) _reload();
  }

  Future<void> _copy(ProductRow p) async {
    try {
      final id = await ref.read(productRepositoryProvider).copy(p.id);
      if (!mounted) return;
      _say('Copied. It is switched off until you turn it on.');
      await _open('/products/$id/edit');
    } on ApiException catch (e) {
      if (mounted) _say(e.message);
    }
  }

  Future<void> _toggle(ProductRow p) async {
    try {
      await ref.read(productRepositoryProvider).setActive(p.id, !p.isActive);
      _reload();
    } on ApiException catch (e) {
      if (mounted) _say(e.message);
    }
  }

  Future<void> _runBulk(String action, {String? mode, String? direction, double? value}) async {
    try {
      final r = await ref.read(productRepositoryProvider).bulk(_selected.toList(), action, mode: mode, direction: direction, value: value);
      if (!mounted) return;
      _say(r.failed == 0 ? '${r.updated} updated' : '${r.updated} updated, ${r.failed} failed: ${r.errors.join('; ')}');
    } on ApiException catch (e) {
      if (mounted) _say(e.message);
    }
    _reload();
  }

  Future<void> _priceDialog() async {
    var mode = 'percent';
    var direction = 'increase';
    final value = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, set) => AlertDialog(
          title: Text('Change prices of ${_selected.length} ${_selected.length == 1 ? 'product' : 'products'}'),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            SegmentedButton<String>(
              segments: const [ButtonSegment(value: 'increase', label: Text('Raise')), ButtonSegment(value: 'decrease', label: Text('Lower'))],
              selected: {direction},
              onSelectionChanged: (s) => set(() => direction = s.first),
            ),
            const SizedBox(height: AppSpacing.s),
            SegmentedButton<String>(
              segments: const [ButtonSegment(value: 'percent', label: Text('By percent')), ButtonSegment(value: 'amount', label: Text('By amount'))],
              selected: {mode},
              onSelectionChanged: (s) => set(() => mode = s.first),
            ),
            const SizedBox(height: AppSpacing.s),
            TextField(
              controller: value,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: InputDecoration(labelText: mode == 'percent' ? 'Percent' : 'Amount (USD)', suffixText: mode == 'percent' ? '%' : null),
            ),
            const SizedBox(height: AppSpacing.xs),
            const Text('Every option of every picked product changes.', style: TextStyle(color: AppTheme.neutral, fontSize: 12)),
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Back')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), style: FilledButton.styleFrom(minimumSize: const Size(110, 48)), child: const Text('Change')),
          ],
        ),
      ),
    );
    final n = double.tryParse(value.text.trim());
    if (ok != true) return;
    if (n == null || n < 0.01) return _say('Enter a number of 0.01 or more.');
    await _runBulk('price', mode: mode, direction: direction, value: n);
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(listRefreshProvider('products'), (_, _) => _reload());
    final access = ref.watch(authProvider).access;
    if (access != null && !access.canManage) {
      return const EmptyView(message: 'Products open once your shop is approved and active.', icon: Icons.inventory_2_outlined);
    }
    final picking = _selected.isNotEmpty;
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: picking ? null : FloatingActionButton.extended(onPressed: () => _open('/products/new'), icon: const Icon(Icons.add), label: const Text('Add product')),
      bottomNavigationBar: picking
          ? SafeArea(
              child: Container(
                padding: const EdgeInsets.all(AppSpacing.s),
                decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: AppTheme.border))),
                child: Row(children: [
                  IconButton(onPressed: () => setState(_selected.clear), icon: const Icon(Icons.close)),
                  Expanded(child: Text('${_selected.length} selected', style: const TextStyle(fontWeight: FontWeight.w700))),
                  TextButton(onPressed: () => _runBulk('activate'), child: const Text('On')),
                  TextButton(onPressed: () => _runBulk('deactivate'), child: const Text('Off')),
                  FilledButton(onPressed: _priceDialog, style: FilledButton.styleFrom(minimumSize: const Size(0, 44)), child: const Text('Prices')),
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
              hintText: 'Search your products',
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
        _chips([
          ('All', _filter.status == null, () => _apply(_filter.copyWith(clearStatus: true))),
          for (final s in const ['approved', 'pending', 'rejected']) (productStatusLabel(s), _filter.status == s, () => _apply(_filter.copyWith(status: s))),
        ]),
        _chips([
          ('Any activity', _filter.activeStatus == null, () => _apply(_filter.copyWith(clearActive: true))),
          for (final s in const ['active', 'inactive', 'suspended']) (productStatusLabel(s), _filter.activeStatus == s, () => _apply(_filter.copyWith(activeStatus: s))),
        ]),
        Expanded(
          child: ListenableBuilder(
            listenable: _list,
            builder: (context, _) {
              if (_list.loading && _list.items.isEmpty) return const LoadingView();
              if (_list.error != null && _list.items.isEmpty) return ErrorView(message: _list.error!, onRetry: _reload);
              if (_list.items.isEmpty) return const EmptyView(message: 'No products match.', icon: Icons.inventory_2_outlined);
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
                    final p = _list.items[i];
                    final selected = _selected.contains(p.id);
                    return GestureDetector(
                      onLongPress: () => setState(() => selected ? _selected.remove(p.id) : _selected.add(p.id)),
                      child: Container(
                        decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: selected ? AppTheme.ink : Colors.transparent, width: 2)),
                        child: AppCard(
                          onTap: () => picking ? setState(() => selected ? _selected.remove(p.id) : _selected.add(p.id)) : _open('/products/${p.id}'),
                          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            if (picking) Padding(padding: const EdgeInsets.only(right: AppSpacing.s), child: Icon(selected ? Icons.check_circle : Icons.circle_outlined)),
                            ImageThumb(p.thumbnailUrl, size: 64),
                            const SizedBox(width: AppSpacing.m),
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text(p.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
                                if (p.categoryName != null) Text(p.categoryName!, style: const TextStyle(color: AppTheme.neutral, fontSize: 13)),
                                const SizedBox(height: AppSpacing.xs),
                                Wrap(spacing: AppSpacing.xs, runSpacing: AppSpacing.xs, children: [
                                  StatusBadge(label: productStatusLabel(p.status), tone: reviewTone(p.status)),
                                  StatusBadge(label: productStatusLabel(p.activeStatus), tone: activityTone(p.activeStatus)),
                                ]),
                                const SizedBox(height: AppSpacing.xs),
                                Text(
                                  '${p.wishlistCount} saved${p.ratingCount > 0 ? ' · ${p.ratingAverage.toStringAsFixed(1)} ★ (${p.ratingCount})' : ''}',
                                  style: const TextStyle(color: AppTheme.neutral, fontSize: 12),
                                ),
                              ]),
                            ),
                            if (!picking)
                              PopupMenuButton<String>(
                                onSelected: (v) => switch (v) {
                                  'copy' => _copy(p),
                                  'toggle' => _toggle(p),
                                  _ => _open('/products/${p.id}/edit'),
                                },
                                itemBuilder: (_) => [
                                  if (!p.locked) const PopupMenuItem(value: 'edit', child: Text('Edit')),
                                  if (!p.locked) PopupMenuItem(value: 'toggle', child: Text(p.isActive ? 'Switch off' : 'Switch on')),
                                  const PopupMenuItem(value: 'copy', child: Text('Copy')),
                                ],
                              ),
                          ]),
                        ),
                      ),
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

  Widget _chips(List<(String, bool, VoidCallback)> items) => SizedBox(
        height: 44,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m),
          children: [
            for (final c in items)
              Padding(padding: const EdgeInsets.only(right: AppSpacing.s), child: ChoiceChip(label: Text(c.$1), selected: c.$2, onSelected: (_) => c.$3())),
          ],
        ),
      );
}
