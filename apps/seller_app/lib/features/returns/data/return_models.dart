import '../../../shared/models/attachment.dart';

double _d(Object? v) => (v as num?)?.toDouble() ?? 0;
int _i(Object? v) => (v as num?)?.toInt() ?? 0;
String? _s(Object? v) => (v is String && v.isNotEmpty) ? v : null;
Map<String, dynamic> _m(Object? v) => (v as Map<String, dynamic>?) ?? const {};
List<Map<String, dynamic>> _l(Object? v) => [for (final e in (v as List? ?? const [])) e as Map<String, dynamic>];
DateTime? _t(Object? v) => v == null ? null : DateTime.tryParse(v as String);
final _epoch = DateTime.fromMillisecondsSinceEpoch(0);

const returnReasons = {
  'not_as_described': 'Not as described',
  'sick_or_injured': 'Sick or injured',
  'wrong_bird': 'Wrong bird',
  'damaged_in_transit': 'Damaged in transit',
  'late_delivery': 'Late delivery',
  'changed_mind': 'Changed mind',
  'other': 'Other',
};

class ReturnRow {
  ReturnRow(Map<String, dynamic> j)
      : id = _i(j['id']),
        returnNumber = j['returnNumber'] as String? ?? '',
        status = j['status'] as String? ?? '',
        scope = j['scope'] as String? ?? '',
        reason = _s(j['reason']),
        reasonCode = _s(j['reasonCode']),
        orderNumber = _m(j['order'])['orderNumber'] as String? ?? '',
        itemCount = _i(j['itemCount']),
        productName = _s(_l(j['previewItems']).isEmpty ? null : _l(j['previewItems']).first['productName']),
        refundAmount = _d(j['refundAmount']),
        commissionAmount = _d(j['commissionAmount']),
        includeDeliveryCharge = j['includeDeliveryCharge'] as bool? ?? false,
        createdAt = _t(j['createdAt']) ?? _epoch;
  final int id, itemCount;
  final String returnNumber, status, scope, orderNumber;
  final String? reason, reasonCode, productName;
  final double refundAmount, commissionAmount;
  final bool includeDeliveryCharge;
  final DateTime createdAt;
  bool get fullOrder => scope == 'full_order';
}

class ReturnItem {
  ReturnItem(Map<String, dynamic> j)
      : name = j['productName'] as String? ?? '',
        skuLabel = _s(j['skuLabel']),
        quantity = _i(j['quantity']),
        refundAmount = _d(j['refundAmount']);
  final String name;
  final String? skuLabel;
  final int quantity;
  final double refundAmount;
}

class ReturnStep {
  ReturnStep(Map<String, dynamic> j)
      : status = j['status'] as String? ?? '',
        note = _s(j['note']),
        by = _s(_m(j['by'])['name']),
        at = _t(j['createdAt']) ?? _epoch,
        attachments = Attachment.list(j['attachments']);
  final String status;
  final String? note, by;
  final DateTime at;
  final List<Attachment> attachments;
}

class ReturnDetail {
  ReturnDetail(Map<String, dynamic> j)
      : row = ReturnRow(j),
        itemsAmount = _d(j['itemsAmount']),
        deliveryAmount = _d(j['deliveryAmount']),
        deliveryCharge = _d(j['deliveryCharge']),
        customerName = _s(_m(j['customer'])['name']),
        customerPhone = _s(_m(j['customer'])['phone']),
        items = [for (final i in _l(j['items'])) ReturnItem(i)],
        history = [for (final h in _l(j['history'])) ReturnStep(h)],
        sellerNext = [for (final s in (_m(j['actions'])['sellerNext'] as List? ?? const [])) s as String],
        canEditDelivery = _m(j['actions'])['canEditDelivery'] as bool? ?? false,
        moneyRecords = [for (final r in _l(j['moneyRecords'])) RefundRecord(r)];
  final ReturnRow row;
  final double itemsAmount, deliveryAmount, deliveryCharge;
  final String? customerName, customerPhone;
  final List<ReturnItem> items;
  final List<ReturnStep> history;

  /// What the seller may do next: accept, reject, processing, returning_money.
  final List<String> sellerNext;
  final bool canEditDelivery;
  final List<RefundRecord> moneyRecords;
}

/// One refund record (a cancelled order's refund, or an extra money record on a return).
class RefundRecord {
  RefundRecord(Map<String, dynamic> j)
      : id = _i(j['id']),
        status = j['status'] as String? ?? '',
        expectedAmount = _d(j['expectedAmount']),
        amount = j['amount'] == null ? null : _d(j['amount']),
        note = _s(j['note']),
        transactionId = _s(j['transactionId']),
        proof = Attachment.list(j['proof']),
        refundedAt = _t(j['refundedAt']),
        createdAt = _t(j['createdAt']) ?? _epoch,
        orderNumber = _s(_m(j['order'])['orderNumber']),
        customerName = _s(_m(j['order'])['customerName']),
        orderPaid = _d(_m(j['order'])['amountPaid']);
  final int id;
  final String status;
  final double expectedAmount, orderPaid;
  final double? amount;
  final String? note, transactionId, orderNumber, customerName;
  final List<Attachment> proof;
  final DateTime? refundedAt;
  final DateTime createdAt;

  /// The next step a seller may take (one at a time), or null.
  String? get next => switch (status) {
        'needs_to_refund' => 'processing',
        'processing' => 'refunded',
        _ => null,
      };
}
