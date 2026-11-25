import '../../../shared/models/attachment.dart';

double _d(Object? v) => (v as num?)?.toDouble() ?? 0;
int _i(Object? v) => (v as num?)?.toInt() ?? 0;
String? _s(Object? v) => (v is String && v.isNotEmpty) ? v : null;
Map<String, dynamic> _m(Object? v) => (v as Map<String, dynamic>?) ?? const {};
DateTime _t(Object? v) => DateTime.tryParse(v as String? ?? '') ?? DateTime.fromMillisecondsSinceEpoch(0);

/// "10%" or "$3.33 per order line", for a commission type and value.
String rateText(String? type, double value) => type == 'percentage' ? '${value % 1 == 0 ? value.toInt() : value}%' : '\$${value.toStringAsFixed(2)} per line';

class CommissionBalance {
  CommissionBalance(Map<String, dynamic> j)
      : total = _d(j['totalCommission']),
        due = _d(j['dueCommission']),
        paid = _d(j['paidCommission']),
        rateType = _s(_m(_m(j['commission'])['effective'])['type']),
        rateValue = _d(_m(_m(j['commission'])['effective'])['value']),
        rateSource = _s(_m(_m(j['commission'])['effective'])['source']);
  final double total, due, paid, rateValue;
  final String? rateType, rateSource;
}

class CommissionLine {
  CommissionLine(Map<String, dynamic> j)
      : type = j['type'] as String? ?? '',
        orderNumber = _s(j['orderNumber']),
        amount = _d(j['totalAmount']),
        orderSubtotal = _d(j['orderSubtotal']),
        commissionType = _s(j['commissionType']),
        commissionValue = _d(j['commissionValue']),
        dueAfter = _d(j['dueAfter']),
        voidReason = _s(j['voidReason']),
        voided = j['voidedAt'] != null,
        createdAt = _t(j['createdAt']);
  final String type;
  final String? orderNumber, commissionType, voidReason;
  final double amount, orderSubtotal, commissionValue, dueAfter;
  final bool voided;
  final DateTime createdAt;

  String get title => switch (type) {
        'order_commission' => 'Commission on ${orderNumber ?? 'an order'}',
        'commission_payment' => 'You paid the marketplace',
        'order_return' => 'Commission given back for ${orderNumber ?? 'a return'}',
        _ => type,
      };
}

class RateChange {
  RateChange(Map<String, dynamic> j)
      : fromText = _text(j['fromValue']),
        toText = _text(j['toValue']),
        note = _s(j['note']),
        by = _s(j['changedByName']),
        at = _t(j['changedAt']);
  final String? fromText, note, by;
  final String toText;
  final DateTime at;

  static String _text(Object? v) {
    final m = _m(v);
    if (m.isEmpty) return '';
    return rateText(_s(m['commissionType']), _d(m['commissionAmount']));
  }
}

class Disbursement {
  Disbursement(Map<String, dynamic> j)
      : id = _i(j['id']),
        amount = _d(j['amount']),
        notes = _s(j['notes']),
        dueAmount = _d(j['dueAmount']),
        paidAmount = _d(j['paidAmount']),
        recordedBy = _s(j['recordedByName']),
        attachments = Attachment.list(j['attachments']),
        createdAt = _t(j['createdAt']);
  final int id;
  final double amount, dueAmount, paidAmount;
  final String? notes, recordedBy;
  final List<Attachment> attachments;
  final DateTime createdAt;
}
