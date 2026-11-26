import '../../cart/data/cart_models.dart';

enum DeliveryType { standard, express, pickup }

extension DeliveryTypeKey on DeliveryType {
  String get key => name;
  String get label => switch (this) {
        DeliveryType.standard => 'Standard delivery',
        DeliveryType.express => 'Express delivery',
        DeliveryType.pickup => 'Pickup',
      };

  static DeliveryType fromKey(String key) => DeliveryType.values.firstWhere((d) => d.key == key, orElse: () => DeliveryType.standard);
}

class DeliveryOption {
  DeliveryOption({required this.type, required this.charge, required this.estimatedDays, required this.zoneName, required this.payable});
  final DeliveryType type;
  final num charge;
  final int estimatedDays;
  final String? zoneName;
  final num payable;

  factory DeliveryOption.fromJson(Map<String, dynamic> json) => DeliveryOption(
        type: DeliveryTypeKey.fromKey(json['deliveryType'] as String),
        charge: json['charge'] as num,
        estimatedDays: (json['estimatedDays'] as num?)?.toInt() ?? 0,
        zoneName: json['zoneName'] as String?,
        payable: json['payable'] as num,
      );
}

class ProofField {
  ProofField({required this.key, required this.label, required this.required});
  final String key;
  final String label;
  final bool required;

  factory ProofField.fromJson(Map<String, dynamic> json) => ProofField(key: json['key'] as String, label: json['label'] as String, required: json['required'] as bool);
}

class GatewayOption {
  GatewayOption({required this.id, required this.name, required this.description, required this.accountName, required this.accountNumber, required this.bankName, required this.proofFields});
  final int id;
  final String name;
  final String? description;
  final String? accountName;
  final String? accountNumber;
  final String? bankName;
  final List<ProofField> proofFields;

  factory GatewayOption.fromJson(Map<String, dynamic> json) => GatewayOption(
        id: json['id'] as int,
        name: json['name'] as String,
        description: json['description'] as String?,
        accountName: json['accountName'] as String?,
        accountNumber: json['accountNumber'] as String?,
        bankName: json['bankName'] as String?,
        proofFields: (json['proofFields'] as List).cast<Map<String, dynamic>>().map(ProofField.fromJson).toList(),
      );
}

class CheckoutOptions {
  CheckoutOptions({required this.cart, required this.countryCode, required this.deliveryOptions, required this.paymentGateways});
  final Cart cart;
  final String? countryCode;
  final List<DeliveryOption> deliveryOptions;
  final List<GatewayOption> paymentGateways;

  factory CheckoutOptions.fromJson(Map<String, dynamic> json) => CheckoutOptions(
        cart: Cart.fromJson(json['cart'] as Map<String, dynamic>),
        countryCode: json['countryCode'] as String?,
        deliveryOptions: (json['deliveryOptions'] as List).cast<Map<String, dynamic>>().map(DeliveryOption.fromJson).toList(),
        paymentGateways: (json['paymentGateways'] as List).cast<Map<String, dynamic>>().map(GatewayOption.fromJson).toList(),
      );
}

class PlaceOrderInput {
  const PlaceOrderInput({
    required this.recipientName,
    required this.recipientPhone,
    this.contactEmail,
    required this.countryCode,
    this.state,
    required this.city,
    required this.addressLine,
    this.postalCode,
    required this.deliveryType,
    required this.paymentGatewayId,
    this.note,
    this.paymentProof,
    this.expectedItemsTotal,
  });
  final String recipientName;
  final String recipientPhone;
  final String? contactEmail;
  final String countryCode;
  final String? state;
  final String city;
  final String addressLine;
  final String? postalCode;
  final DeliveryType deliveryType;
  final int paymentGatewayId;
  final String? note;
  final Map<String, String>? paymentProof;
  final num? expectedItemsTotal;

  Map<String, dynamic> toJson() => {
        'recipientName': recipientName,
        'recipientPhone': recipientPhone,
        if (contactEmail != null && contactEmail!.isNotEmpty) 'contactEmail': contactEmail,
        'countryCode': countryCode,
        if (state != null && state!.isNotEmpty) 'state': state,
        'city': city,
        'addressLine': addressLine,
        if (postalCode != null && postalCode!.isNotEmpty) 'postalCode': postalCode,
        'deliveryType': deliveryType.key,
        'paymentGatewayId': paymentGatewayId,
        if (note != null && note!.isNotEmpty) 'note': note,
        if (paymentProof != null) 'paymentProof': paymentProof,
        if (expectedItemsTotal != null) 'expectedItemsTotal': expectedItemsTotal,
      };
}

class PlacedOrder {
  PlacedOrder({required this.id, required this.orderNumber, required this.status, required this.payable, required this.sellerName});
  final int id;
  final String orderNumber;
  final String status;
  final num payable;
  final String sellerName;

  factory PlacedOrder.fromJson(Map<String, dynamic> json) => PlacedOrder(
        id: json['id'] as int,
        orderNumber: json['orderNumber'] as String,
        status: json['status'] as String,
        payable: (json['totals'] as Map<String, dynamic>)['payable'] as num,
        sellerName: (json['seller'] as Map<String, dynamic>)['name'] as String,
      );
}
