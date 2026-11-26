import '../../../core/config/app_config.dart';

String? _media(String? url) => url == null ? null : AppConfig.mediaUrl(url);

const kReturnStatuses = ['return_requested', 'accepted', 'rejected', 'processing', 'returning_money', 'returned', 'cancelled'];

const kReturnReasons = [
  ('not_as_described', 'Not as described'),
  ('sick_or_injured', 'Sick or injured'),
  ('wrong_bird', 'Wrong bird or item sent'),
  ('damaged_in_transit', 'Hurt or damaged on the way'),
  ('late_delivery', 'Arrived too late'),
  ('changed_mind', 'Changed my mind'),
  ('other', 'Other'),
];

class ReturnSummary {
  ReturnSummary({required this.id, required this.returnNumber, required this.status, required this.scope, required this.orderId, required this.orderNumber, required this.itemCount, required this.refundAmount, required this.createdAt});
  final int id;
  final String returnNumber;
  final String status;
  final String scope;
  final int orderId;
  final String? orderNumber;
  final int itemCount;
  final num refundAmount;
  final DateTime createdAt;

  factory ReturnSummary.fromJson(Map<String, dynamic> json) {
    final order = json['order'] as Map<String, dynamic>;
    return ReturnSummary(
      id: json['id'] as int,
      returnNumber: json['returnNumber'] as String,
      status: json['status'] as String,
      scope: json['scope'] as String,
      orderId: order['id'] as int,
      orderNumber: order['orderNumber'] as String?,
      itemCount: (json['itemCount'] as num).toInt(),
      refundAmount: json['refundAmount'] as num,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

class ReturnItemView {
  ReturnItemView({required this.productName, required this.imageUrl, required this.quantity, required this.refundAmount});
  final String productName;
  final String? imageUrl;
  final int quantity;
  final num refundAmount;

  factory ReturnItemView.fromJson(Map<String, dynamic> json) => ReturnItemView(
        productName: json['productName'] as String,
        imageUrl: _media(json['imageUrl'] as String?),
        quantity: (json['quantity'] as num).toInt(),
        refundAmount: json['refundAmount'] as num,
      );
}

class ReturnHistoryEntry {
  ReturnHistoryEntry({required this.status, required this.note, required this.byName, required this.createdAt});
  final String status;
  final String? note;
  final String? byName;
  final DateTime createdAt;

  factory ReturnHistoryEntry.fromJson(Map<String, dynamic> json) => ReturnHistoryEntry(
        status: json['status'] as String,
        note: json['note'] as String?,
        byName: (json['by'] as Map<String, dynamic>?)?['name'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}

class ReturnDetail extends ReturnSummary {
  ReturnDetail({
    required super.id,
    required super.returnNumber,
    required super.status,
    required super.scope,
    required super.orderId,
    required super.orderNumber,
    required super.itemCount,
    required super.refundAmount,
    required super.createdAt,
    required this.reason,
    required this.items,
    required this.history,
    required this.canCancel,
  });
  final String reason;
  final List<ReturnItemView> items;
  final List<ReturnHistoryEntry> history;
  final bool canCancel;

  factory ReturnDetail.fromJson(Map<String, dynamic> json) {
    final base = ReturnSummary.fromJson(json);
    final actions = json['actions'] as Map<String, dynamic>;
    return ReturnDetail(
      id: base.id,
      returnNumber: base.returnNumber,
      status: base.status,
      scope: base.scope,
      orderId: base.orderId,
      orderNumber: base.orderNumber,
      itemCount: base.itemCount,
      refundAmount: base.refundAmount,
      createdAt: base.createdAt,
      reason: json['reason'] as String,
      items: (json['items'] as List).cast<Map<String, dynamic>>().map(ReturnItemView.fromJson).toList(),
      history: (json['history'] as List).cast<Map<String, dynamic>>().map(ReturnHistoryEntry.fromJson).toList(),
      canCancel: actions['canCancel'] as bool,
    );
  }
}

class EligibleItem {
  EligibleItem({required this.orderItemId, required this.productName, required this.quantity, required this.refundAmount, required this.allowed, required this.reason});
  final int orderItemId;
  final String productName;
  final int quantity;
  final num refundAmount;
  final bool allowed;
  final String? reason;

  factory EligibleItem.fromJson(Map<String, dynamic> json) => EligibleItem(
        orderItemId: json['orderItemId'] as int,
        productName: json['productName'] as String,
        quantity: (json['quantity'] as num).toInt(),
        refundAmount: json['refundAmount'] as num,
        allowed: json['allowed'] as bool,
        reason: json['reason'] as String?,
      );
}

class ReturnEligibility {
  ReturnEligibility({required this.fullOrderAllowed, required this.fullOrderReason, required this.fullOrderRefund, required this.items});
  final bool fullOrderAllowed;
  final String? fullOrderReason;
  final num fullOrderRefund;
  final List<EligibleItem> items;

  factory ReturnEligibility.fromJson(Map<String, dynamic> json) {
    final fullOrder = json['fullOrder'] as Map<String, dynamic>;
    return ReturnEligibility(
      fullOrderAllowed: fullOrder['allowed'] as bool,
      fullOrderReason: fullOrder['reason'] as String?,
      fullOrderRefund: fullOrder['refundAmount'] as num,
      items: (json['items'] as List).cast<Map<String, dynamic>>().map(EligibleItem.fromJson).toList(),
    );
  }
}
