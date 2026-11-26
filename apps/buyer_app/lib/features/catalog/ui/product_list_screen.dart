import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/paging/page_list_controller.dart' as paging;
import '../../../shared/widgets/empty_view.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../data/storefront_api.dart';
import '../data/storefront_models.dart';
import '../widgets/product_tile.dart';

/// A product grid for one filter (category, collection, seller, or the
/// open-ended /products browse page). [showFilters] turns on the search
/// field, sort menu and breed/bloodline chips — turn it off for an
/// already-scoped list (a category or seller page) to keep it simple.
class ProductListScreen extends ConsumerStatefulWidget {
  const ProductListScreen({super.key, required this.query, this.showFilters = false, this.title, this.emptyText = 'No birds here yet.', this.header});

  final ProductQuery query;
  final bool showFilters;
  final String? title;
  final String emptyText;
  /// Shown above the grid, scrolling with it (a category's breadcrumb and subcategories, say).
  final Widget? header;

  @override
  ConsumerState<ProductListScreen> createState() => _ProductListScreenState();
}

class _ProductListScreenState extends ConsumerState<ProductListScreen> {
  late ProductQuery _query = widget.query;
  late paging.PageListController<StoreProduct> _list;
  final _search = TextEditingController();

  @override
  void initState() {
    super.initState();
    _buildList();
  }

  void _buildList() {
    _list = paging.PageListController<StoreProduct>((page) async {
      final result = await ref.read(storefrontApiProvider).products(_query, page);
      return paging.PagedResult(items: result.results, page: result.page, totalPages: result.totalPages);
    })
      ..loadFirst();
  }

  void _apply(ProductQuery next) {
    setState(() {
      _query = next;
      _list.dispose();
      _buildList();
    });
  }

  @override
  void dispose() {
    _list.dispose();
    _search.dispose();
    super.dispose();
  }

  Future<void> _openFilters() async {
    final filters = await ref.read(storefrontApiProvider).birdFilters();
    if (!mounted) return;
    final result = await showModalBottomSheet<ProductQuery>(
      context: context,
      showDragHandle: true,
      builder: (_) => _FilterSheet(filters: filters, current: _query),
    );
    if (result != null) _apply(result);
  }

  @override
  Widget build(BuildContext context) {
    final body = Column(
      children: [
        if (widget.showFilters) _Toolbar(query: _query, searchController: _search, onSearch: (s) => _apply(_query.copyWith(search: s)), onSort: (sort) => _apply(_query.copyWith(sort: sort)), onFilters: _openFilters),
        Expanded(
          child: ListenableBuilder(
            listenable: _list,
            builder: (context, _) {
              if (_list.loading && _list.items.isEmpty) {
                return ListView(children: [if (widget.header != null) widget.header!, const Padding(padding: EdgeInsets.all(AppSpacing.xl), child: LoadingView())]);
              }
              if (_list.error != null && _list.items.isEmpty) return ErrorView(message: _list.error!, onRetry: _list.loadFirst);
              return NotificationListener<ScrollNotification>(
                onNotification: (n) {
                  if (n.metrics.pixels > n.metrics.maxScrollExtent - 400) _list.loadMore();
                  return false;
                },
                child: RefreshIndicator(
                  onRefresh: _list.loadFirst,
                  child: ListView(
                    padding: EdgeInsets.zero,
                    children: [
                      if (widget.header != null) widget.header!,
                      if (_list.items.isEmpty) Padding(padding: const EdgeInsets.all(AppSpacing.xl), child: EmptyView(message: widget.emptyText, icon: Icons.search_off)),
                      ProductGrid(products: _list.items),
                      if (_list.loadingMore) const Padding(padding: EdgeInsets.all(AppSpacing.m), child: Center(child: CircularProgressIndicator())),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
    if (widget.title == null) return body;
    return Scaffold(appBar: AppBar(title: Text(widget.title!)), body: body);
  }
}

class _Toolbar extends StatelessWidget {
  const _Toolbar({required this.query, required this.searchController, required this.onSearch, required this.onSort, required this.onFilters});
  final ProductQuery query;
  final TextEditingController searchController;
  final ValueChanged<String> onSearch;
  final ValueChanged<ProductSort> onSort;
  final VoidCallback onFilters;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.m, AppSpacing.m, AppSpacing.m, AppSpacing.s),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: searchController,
              decoration: const InputDecoration(hintText: 'Search birds', prefixIcon: Icon(Icons.search), isDense: true),
              onSubmitted: onSearch,
            ),
          ),
          const SizedBox(width: AppSpacing.s),
          IconButton(onPressed: onFilters, icon: const Icon(Icons.tune), tooltip: 'Filters'),
          PopupMenuButton<ProductSort>(
            icon: const Icon(Icons.sort),
            onSelected: onSort,
            itemBuilder: (_) => [for (final s in ProductSort.values) PopupMenuItem(value: s, child: Text(s.label))],
          ),
        ],
      ),
    );
  }
}

class _FilterSheet extends StatefulWidget {
  const _FilterSheet({required this.filters, required this.current});
  final BirdFilters filters;
  final ProductQuery current;

  @override
  State<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<_FilterSheet> {
  String? _breed;
  String? _bloodline;

  @override
  void initState() {
    super.initState();
    _breed = widget.current.breed;
    _bloodline = widget.current.bloodline;
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpacing.m, 0, AppSpacing.m, AppSpacing.l),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Breed', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.s),
          Wrap(
            spacing: AppSpacing.s,
            children: [
              for (final b in widget.filters.breeds) ChoiceChip(label: Text(b), selected: _breed == b, onSelected: (sel) => setState(() => _breed = sel ? b : null)),
            ],
          ),
          const SizedBox(height: AppSpacing.m),
          Text('Bloodline', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.s),
          Wrap(
            spacing: AppSpacing.s,
            children: [
              for (final b in widget.filters.bloodlines) ChoiceChip(label: Text(b), selected: _bloodline == b, onSelected: (sel) => setState(() => _bloodline = sel ? b : null)),
            ],
          ),
          const SizedBox(height: AppSpacing.l),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context, ProductQuery(search: widget.current.search, categoryId: widget.current.categoryId, collectionId: widget.current.collectionId, sellerId: widget.current.sellerId, featured: widget.current.featured, sort: widget.current.sort)),
                  child: const Text('Clear'),
                ),
              ),
              const SizedBox(width: AppSpacing.m),
              Expanded(
                child: FilledButton(
                  onPressed: () => Navigator.pop(
                    context,
                    ProductQuery(
                      search: widget.current.search,
                      categoryId: widget.current.categoryId,
                      collectionId: widget.current.collectionId,
                      sellerId: widget.current.sellerId,
                      featured: widget.current.featured,
                      breed: _breed,
                      bloodline: _bloodline,
                      sort: widget.current.sort,
                    ),
                  ),
                  child: const Text('Apply'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
