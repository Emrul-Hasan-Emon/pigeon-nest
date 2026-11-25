double _d(Object? v) => (v as num?)?.toDouble() ?? 0;
int _i(Object? v) => (v as num?)?.toInt() ?? 0;
String? _s(Object? v) => (v is String && v.isNotEmpty) ? v : null;
Map<String, dynamic> _m(Object? v) => (v as Map<String, dynamic>?) ?? const {};
List<Map<String, dynamic>> _l(Object? v) => [for (final e in (v as List? ?? const [])) e as Map<String, dynamic>];
DateTime _t(Object? v) => DateTime.tryParse(v as String? ?? '') ?? DateTime.fromMillisecondsSinceEpoch(0);

class OfferStep {
  OfferStep(Map<String, dynamic> j)
      : action = j['action'] as String? ?? '',
        by = _s(j['actorName']),
        byType = _s(j['actorType']),
        price = _d(j['price']),
        quantity = _i(j['quantity']),
        note = _s(j['note']),
        at = _t(j['createdAt']);
  final String action;
  final String? by, byType, note;
  final double price;
  final int quantity;
  final DateTime at;
}

/// A buyer's price offer on one of the seller's options, and the back and forth that followed.
class Offer {
  Offer(Map<String, dynamic> j)
      : id = _i(j['id']),
        status = j['status'] as String? ?? '',
        awaitingParty = _s(j['awaitingParty']),
        quantity = _i(j['quantity']),
        price = _d(j['price']),
        total = _d(j['total']),
        skuPriceAtCreate = _d(j['skuPriceAtCreate']),
        skuPriceNow = _d(j['skuPriceNow']),
        stock = _i(j['stock']),
        buyerName = _s(_m(j['buyer'])['name']) ?? 'Buyer',
        productName = _s(_m(j['product'])['name']) ?? '',
        productImage = _s(_m(j['product'])['thumbnailUrl']),
        skuLabel = _s(_m(j['sku'])['label']) ?? _s(_m(j['sku'])['sku']),
        closeNote = _s(j['closeNote']),
        createdAt = _t(j['createdAt']),
        actions = [for (final a in (j['actions'] as List? ?? const [])) a as String],
        history = [for (final h in _l(j['history'])) OfferStep(h)];
  final int id, quantity, stock;
  final String status, buyerName, productName;
  final String? awaitingParty, productImage, skuLabel, closeNote;
  final double price, total, skuPriceAtCreate, skuPriceNow;
  final DateTime createdAt;

  /// What the seller may do now: accept, counter, reject.
  final List<String> actions;
  final List<OfferStep> history;

  bool get awaitingYou => status == 'pending' && awaitingParty == 'seller';
}

class OfferSummary {
  OfferSummary(Map<String, dynamic> j)
      : pending = _i(j['pending']),
        awaitingYou = _i(j['awaitingYou']),
        accepted = _i(j['accepted']),
        used = _i(j['used']),
        closed = _i(j['closed']);
  final int pending, awaitingYou, accepted, used, closed;
}
