import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../paging/cursor_list_controller.dart';
import 'empty_view.dart';
import 'error_view.dart';
import 'loading_view.dart';

/// A cursor-paged list that loads more as it scrolls. Change [reloadKey] (a filter, a search) to start over.
class CursorList<T> extends StatefulWidget {
  const CursorList({
    super.key,
    required this.fetch,
    required this.itemBuilder,
    required this.emptyText,
    this.reloadKey,
    this.emptyIcon = Icons.inbox_outlined,
    this.header,
  });

  final CursorFetcher<T> fetch;
  final Widget Function(BuildContext, T) itemBuilder;
  final String emptyText;
  final Object? reloadKey;
  final IconData emptyIcon;
  final Widget? header;

  @override
  State<CursorList<T>> createState() => _CursorListState<T>();
}

class _CursorListState<T> extends State<CursorList<T>> {
  late CursorListController<T> _list;
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _list = CursorListController(widget.fetch)..loadFirst();
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 300) _list.loadMore();
    });
  }

  @override
  void didUpdateWidget(CursorList<T> old) {
    super.didUpdateWidget(old);
    if (old.reloadKey != widget.reloadKey) reload();
  }

  void reload() {
    _list.dispose();
    setState(() => _list = CursorListController(widget.fetch)..loadFirst());
  }

  @override
  void dispose() {
    _scroll.dispose();
    _list.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: _list,
        builder: (context, _) {
          if (_list.loading && _list.items.isEmpty) return const LoadingView();
          if (_list.error != null && _list.items.isEmpty) return ErrorView(message: _list.error!, onRetry: reload);
          final offset = widget.header == null ? 0 : 1;
          return RefreshIndicator(
            onRefresh: () async => reload(),
            child: ListView.separated(
              controller: _scroll,
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(AppSpacing.m),
              itemCount: offset + (_list.items.isEmpty ? 1 : _list.items.length) + (_list.hasMore && _list.items.isNotEmpty ? 1 : 0),
              separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.s),
              itemBuilder: (_, i) {
                if (i < offset) return widget.header!;
                final n = i - offset;
                if (_list.items.isEmpty) return SizedBox(height: 300, child: EmptyView(message: widget.emptyText, icon: widget.emptyIcon));
                if (n >= _list.items.length) return const Padding(padding: EdgeInsets.all(AppSpacing.m), child: Center(child: CircularProgressIndicator()));
                return widget.itemBuilder(context, _list.items[n]);
              },
            ),
          );
        },
      );
}
