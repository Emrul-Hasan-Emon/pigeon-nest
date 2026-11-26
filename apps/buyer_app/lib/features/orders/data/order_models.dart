import '../../../core/config/app_config.dart';

String? _media(String? url) => url == null ? null : AppConfig.mediaUrl(url);

const kOrderStatuses = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];
const kPaymentStatuses = ['due', 'partially_paid', 'paid'];

class OrderPreviewItem {
  OrderPreviewItem({required this.productName, required this.imageUrl});
  final String productName;
  final String? imageUrl;

  factory OrderPreviewItem.fromJson(Map<String, dynamic> json) => OrderPreviewItem(productName: json['productName'] as String, imageUrl: _media(json['imageUrl'] as String?));
}

class OrderSummary {
  OrderSummary({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.paymentStatus,
    required this.sellerId,
    required this.sellerName,
    required this.sellerAvatarUrl,
    required this.itemCount,
    required this.previewItems,
    required this.payable,
    required this.amountPaid,
    required this.gatewayName,
    required this.createdAt,
    required this.canCancel,
  });
  final int id;
  final String orderNumber;
  final String status;
  final String paymentStatus;
  final int sellerId;
  final String sellerName;
  final String? sellerAvatarUrl;
  final int itemCount;
  final List<OrderPreviewItem> previewItems;
  final num payable;
  final num amountPaid;
  final String gatewayName;
  final DateTime createdAt;
  final bool canCancel;

  factory OrderSummary.fromJson(Map<String, dynamic> json) {
    final seller = json['seller'] as Map<String, dynamic>;
    final gateway = json['gateway'] as Map<String, dynamic>;
    return OrderSummary(
      id: json['id'] as int,
      orderNumber: json['orderNumber'] as String,
      status: json['status'] as String,
      paymentStatus: json['paymentStatus'] as String,
      sellerId: seller['id'] as int,
      sellerName: seller['name'] as String,
      sellerAvatarUrl: _media(seller['avatarUrl'] as String?),
      itemCount: (json['itemCount'] as num).toInt(),
      previewItems: (json['previewItems'] as List).cast<Map<String, dynamic>>().map(OrderPreviewItem.fromJson).toList(),
      payable: json['payable'] as num,
      amountPaid: json['amountPaid'] as num,
      gatewayName: gateway['name'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      canCancel: json['canCancel'] as bool,
    );
  }
}

class OrderItemView {
  OrderItemView({required this.id, required this.productId, required this.productName, required this.imageUrl, required this.skuLabel, required this.quantity, required this.unitPayable, required this.lineTotal});
  final int id;
  final int? productId;
  final String productName;
  final String? imageUrl;
  final String skuLabel;
  final int quantity;
  final num unitPayable;
  final num lineTotal;

  factory OrderItemView.fromJson(Map<String, dynamic> json) {
    final sku = json['sku'] as Map<String, dynamic>?;
    return OrderItemView(
      id: json['id'] as int,
      productId: json['productId'] as int?,
      productName: json['productName'] as String,
      imageUrl: _media(json['imageUrl'] as String?),
      skuLabel: sku?['label'] as String? ?? '',
      quantity: (json['quantity'] as num).toInt(),
      unitPayable: json['unitPayable'] as num,
      lineTotal: json['lineTotal'] as num,
    );
  }
}

class StatusHistoryEntry {
  StatusHistoryEntry({required this.status, required this.note, required this.createdAt});
  final String status;
  final String? note;
  final DateTime createdAt;

  factory StatusHistoryEntry.fromJson(Map<String, dynamic> json) =>
      StatusHistoryEntry(status: json['status'] as String, note: json['note'] as String?, createdAt: DateTime.parse(json['createdAt'] as String));
}

class OrderUpdate {
  OrderUpdate({required this.message, required this.createdAt});
  final String? message;
  final DateTime createdAt;

  factory OrderUpdate.fromJson(Map<String, dynamic> json) => OrderUpdate(message: json['message'] as String?, createdAt: DateTime.parse(json['createdAt'] as String));
}

class OrderPayment {
  OrderPayment({required this.id, required this.status, required this.amount, required this.transactionId, required this.paidAt});
  final int id;
  final String status;
  final num amount;
  final String? transactionId;
  final DateTime? paidAt;

  factory OrderPayment.fromJson(Map<String, dynamic> json) => OrderPayment(
        id: json['id'] as int,
        status: json['status'] as String,
        amount: json['amount'] as num,
        transactionId: json['transactionId'] as String?,
        paidAt: json['paidAt'] == null ? null : DateTime.parse(json['paidAt'] as String),
      );
}

class PaymentAccount {
  PaymentAccount({required this.provider, required this.accountName, required this.accountNumber, required this.branchName, required this.note});
  final String provider;
  final String? accountName;
  final String accountNumber;
  final String? branchName;
  final String? note;

  factory PaymentAccount.fromJson(Map<String, dynamic> json) => PaymentAccount(
        provider: json['provider'] as String,
        accountName: json['accountName'] as String?,
        accountNumber: json['accountNumber'] as String,
        branchName: json['branchName'] as String?,
        note: json['note'] as String?,
      );
}

class OrderDetail {
  OrderDetail({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.paymentStatus,
    required this.sellerId,
    required this.sellerName,
    required this.sellerAvatarUrl,
    required this.payable,
    required this.amountPaid,
    required this.balanceDue,
    required this.deliveryCharge,
    required this.subtotal,
    required this.createdAt,
    required this.canCancel,
    required this.items,
    required this.delivery,
    required this.recipientName,
    required this.phone,
    required this.addressLine,
    required this.city,
    required this.countryName,
    required this.note,
    required this.payTo,
    required this.payments,
    required this.updates,
    required this.statusHistory,
  });
  final int id;
  final String orderNumber;
  final String status;
  final String paymentStatus;
  final int sellerId;
  final String sellerName;
  final String? sellerAvatarUrl;
  final num payable;
  final num amountPaid;
  final num balanceDue;
  final num deliveryCharge;
  final num subtotal;
  final DateTime createdAt;
  final bool canCancel;
  final List<OrderItemView> items;
  final String delivery;
  final String recipientName;
  final String phone;
  final String addressLine;
  final String city;
  final String countryName;
  final String? note;
  final List<PaymentAccount> payTo;
  final List<OrderPayment> payments;
  final List<OrderUpdate> updates;
  final List<StatusHistoryEntry> statusHistory;

  /// A cash/manual order still waiting on money: the buyer may mark it as paid.
  bool get canClaimPayment => paymentStatus != 'paid' && status != 'cancelled';

  factory OrderDetail.fromJson(Map<String, dynamic> json) {
    final seller = json['seller'] as Map<String, dynamic>;
    final totals = json['totals'] as Map<String, dynamic>;
    final delivery = json['delivery'] as Map<String, dynamic>;
    final address = json['address'] as Map<String, dynamic>;
    return OrderDetail(
      id: json['id'] as int,
      orderNumber: json['orderNumber'] as String,
      status: json['status'] as String,
      paymentStatus: json['paymentStatus'] as String,
      sellerId: seller['id'] as int,
      sellerName: seller['name'] as String,
      sellerAvatarUrl: _media(seller['avatarUrl'] as String?),
      payable: totals['payable'] as num,
      amountPaid: totals['amountPaid'] as num,
      balanceDue: totals['balanceDue'] as num,
      deliveryCharge: totals['deliveryCharge'] as num,
      subtotal: totals['subtotal'] as num,
      createdAt: DateTime.parse(json['createdAt'] as String),
      canCancel: json['canCancel'] as bool,
      items: (json['items'] as List).cast<Map<String, dynamic>>().map(OrderItemView.fromJson).toList(),
      delivery: delivery['type'] as String,
      recipientName: address['recipientName'] as String,
      phone: address['phone'] as String,
      addressLine: address['line'] as String,
      city: address['city'] as String,
      countryName: address['countryName'] as String,
      note: json['note'] as String?,
      payTo: (json['payTo'] as List?)?.cast<Map<String, dynamic>>().map(PaymentAccount.fromJson).toList() ?? const [],
      payments: (json['payments'] as List).cast<Map<String, dynamic>>().map(OrderPayment.fromJson).toList(),
      updates: (json['updates'] as List).cast<Map<String, dynamic>>().map(OrderUpdate.fromJson).toList(),
      statusHistory: (json['statusHistory'] as List).cast<Map<String, dynamic>>().map(StatusHistoryEntry.fromJson).toList(),
    );
  }
}
