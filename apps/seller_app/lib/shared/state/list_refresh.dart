import 'package:flutter_riverpod/flutter_riverpod.dart';

/// "This list changed somewhere else, load it again." A list screen watches the signal for its name
/// ('orders', 'products'); a screen that adds or changes an item bumps it. Needed because a screen that
/// replaces itself (add product, then pictures) never hands control back to the list that opened it.
class ListRefresh extends Notifier<int> {
  ListRefresh(this.key);
  final String key;

  @override
  int build() => 0;

  void bump() => state++;
}

final listRefreshProvider = NotifierProvider.family<ListRefresh, int, String>(ListRefresh.new);
