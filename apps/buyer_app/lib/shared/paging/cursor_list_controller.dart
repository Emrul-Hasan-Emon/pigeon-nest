import 'package:flutter/foundation.dart';

/// One page of a cursor list (the shape some buyer lists return:
/// `{results, nextCursor}` — `nextCursor` is null once there is nothing more).
class CursorResult<T> {
  const CursorResult({required this.items, required this.nextCursor});

  final List<T> items;
  final String? nextCursor;
}

typedef CursorFetcher<T> = Future<CursorResult<T>> Function(String? cursor);

/// Loads a cursor-paged list: call [loadFirst] once, then [loadMore] as the
/// buyer scrolls. Mirrors [PageListController]'s shape so both can be used
/// the same way from a screen.
class CursorListController<T> extends ChangeNotifier {
  CursorListController(this._fetch);

  final CursorFetcher<T> _fetch;

  List<T> items = [];
  String? _cursor;
  bool _loadedOnce = false;
  bool loading = false;
  bool loadingMore = false;
  String? error;

  bool get hasMore => !_loadedOnce || _cursor != null;

  Future<void> loadFirst() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final result = await _fetch(null);
      items = result.items;
      _cursor = result.nextCursor;
      _loadedOnce = true;
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
      final result = await _fetch(_cursor);
      items = [...items, ...result.items];
      _cursor = result.nextCursor;
    } catch (e) {
      error = e.toString();
    } finally {
      loadingMore = false;
      notifyListeners();
    }
  }
}
