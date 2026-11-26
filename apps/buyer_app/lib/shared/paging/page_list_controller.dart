import 'package:flutter/foundation.dart';

/// One page of a page-number list (the shape the storefront API returns:
/// `{results, page, pageSize, total, totalPages}`).
class PagedResult<T> {
  const PagedResult({required this.items, required this.page, required this.totalPages});

  final List<T> items;
  final int page;
  final int totalPages;
}

typedef PageFetcher<T> = Future<PagedResult<T>> Function(int page);

/// Loads a page-number paged list: call [loadFirst] once, then [loadMore] as
/// the buyer scrolls. Build a screen's list with a `ListenableBuilder`
/// (or `AnimatedBuilder`) around one of these — no Riverpod wiring needed per
/// list, since this already holds and reports its own state.
class PageListController<T> extends ChangeNotifier {
  PageListController(this._fetch);

  final PageFetcher<T> _fetch;

  List<T> items = [];
  int _page = 0;
  int _totalPages = 1;
  bool loading = false;
  bool loadingMore = false;
  String? error;

  bool get hasMore => _page < _totalPages;

  Future<void> loadFirst() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final result = await _fetch(1);
      items = result.items;
      _page = result.page;
      _totalPages = result.totalPages;
    } catch (e) {
      error = e.toString();
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> loadMore() async {
    if (loadingMore || !hasMore) return;
    loadingMore = true;
    notifyListeners();
    try {
      final result = await _fetch(_page + 1);
      items = [...items, ...result.items];
      _page = result.page;
      _totalPages = result.totalPages;
    } catch (e) {
      error = e.toString();
    } finally {
      loadingMore = false;
      notifyListeners();
    }
  }
}
