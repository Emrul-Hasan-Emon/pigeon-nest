import '../../../shared/models/attachment.dart';

double _d(Object? v) => (v as num?)?.toDouble() ?? 0;
int _i(Object? v) => (v as num?)?.toInt() ?? 0;
String? _s(Object? v) => (v is String && v.isNotEmpty) ? v : null;
Map<String, dynamic> _m(Object? v) => (v as Map<String, dynamic>?) ?? const {};
List<Map<String, dynamic>> _l(Object? v) => [for (final e in (v as List? ?? const [])) e as Map<String, dynamic>];
DateTime? _t(Object? v) => v == null ? null : DateTime.tryParse(v as String);

class PaymentRow {
  PaymentRow(Map<String, dynamic> j)
      : id = _i(j['id']),
        orderId = _i(j['orderId']),
        orderNumber = j['orderNumber'] as String? ?? '',
        customerName = _s(_m(j['customer'])['name']) ?? 'Customer',
        gatewayName = _s(_m(j['gateway'])['name']),
        amount = _d(j['amount']),
        transactionId = _s(j['transactionId']),
        description = _s(j['description']),
        paidAt = _t(j['paidAt']),
        createdAt = _t(j['createdAt']) ?? DateTime.fromMillisecondsSinceEpoch(0),
        reversed = j['reversal'] != null,
        reversalReason = _s(_m(j['reversal'])['reason']),
        recordedBy = _s(_m(j['recordedBy'])['name']),
        attachmentCount = _i(j['attachmentCount']);

  final int id, orderId, attachmentCount;
  final String orderNumber, customerName;
  final String? gatewayName, transactionId, description, reversalReason, recordedBy;
  final double amount;
  final DateTime? paidAt;
  final DateTime createdAt;
  final bool reversed;

  /// A row with no `paidAt` is the amount still expected, not money received.
  bool get received => paidAt != null && !reversed;
}

class PaymentHistoryLine {
  PaymentHistoryLine(Map<String, dynamic> j)
      : status = j['status'] as String? ?? '',
        amount = _d(j['amount']),
        amountPaidAfter = _d(j['amountPaidAfter']),
        note = _s(j['note']),
        by = _s(_m(j['by'])['name']),
        at = _t(j['createdAt']) ?? DateTime.fromMillisecondsSinceEpoch(0);
  final String status;
  final double amount, amountPaidAfter;
  final String? note, by;
  final DateTime at;
}

class PaymentDetail {
  PaymentDetail(Map<String, dynamic> j)
      : row = PaymentRow(j),
        proof = j['proof'],
        attachments = Attachment.list(j['attachments']),
        history = [for (final h in _l(j['history'])) PaymentHistoryLine(h)],
        orderPayable = _d(_m(j['order'])['payable']),
        orderPaid = _d(_m(j['order'])['amountPaid']),
        orderDue = _d(_m(j['order'])['balanceDue']);
  final PaymentRow row;
  final Object? proof;
  final List<Attachment> attachments;
  final List<PaymentHistoryLine> history;
  final double orderPayable, orderPaid, orderDue;
}

/// An "I have paid" message from a buyer.
class Claim {
  Claim(Map<String, dynamic> j)
      : id = _i(j['id']),
        orderId = _i(_m(j['order'])['id']),
        orderNumber = _m(j['order'])['orderNumber'] as String? ?? '',
        orderPayable = _d(_m(j['order'])['payable']),
        orderPaid = _d(_m(j['order'])['paid']),
        buyerName = _s(j['buyerName']) ?? 'Buyer',
        amount = _d(j['amount']),
        transactionId = _s(j['transactionId']),
        method = _s(j['method']),
        senderNumber = _s(j['senderNumber']),
        paidOn = _s(j['paidOn']),
        note = _s(j['note']),
        attachments = Attachment.list(j['attachments']),
        status = j['status'] as String? ?? '',
        decisionNote = _s(j['decisionNote']),
        createdAt = _t(j['createdAt']) ?? DateTime.fromMillisecondsSinceEpoch(0);
  final int id, orderId;
  final String orderNumber, buyerName, status;
  final double orderPayable, orderPaid, amount;
  final String? transactionId, method, senderNumber, paidOn, note, decisionNote;
  final List<Attachment> attachments;
  final DateTime createdAt;
  bool get pending => status == 'pending';
}

class PayAccount {
  PayAccount(Map<String, dynamic> j)
      : id = _i(j['id']),
        kind = j['kind'] as String? ?? 'mfs',
        provider = j['provider'] as String? ?? '',
        accountName = _s(j['accountName']),
        accountNumber = j['accountNumber'] as String? ?? '',
        branchName = _s(j['branchName']),
        note = _s(j['note']),
        isActive = j['isActive'] as bool? ?? true;
  final int id;
  final String kind, provider, accountNumber;
  final String? accountName, branchName, note;
  final bool isActive;
  bool get isBank => kind == 'bank';
}
