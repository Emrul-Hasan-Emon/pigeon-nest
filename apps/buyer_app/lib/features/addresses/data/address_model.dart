import '../../../core/data/countries.dart';

/// Mirrors the server's `AddressView` (`/profile/addresses*`).
class AddressView {
  const AddressView({
    required this.id,
    required this.type,
    required this.recipientName,
    required this.phone,
    required this.countryCode,
    required this.state,
    required this.city,
    required this.address,
    required this.zipCode,
    required this.isDefault,
  });

  final int id;
  final String type;
  final String recipientName;
  final String phone;
  final String countryCode;
  /// State, province or division.
  final String? state;
  /// City or district.
  final String city;
  final String address;
  final String? zipCode;
  final bool isDefault;

  String get countryName => countryNames[countryCode] ?? countryCode;

  factory AddressView.fromJson(Map<String, dynamic> json) => AddressView(
        id: json['id'] as int,
        type: json['type'] as String? ?? 'shipping',
        recipientName: json['recipientName'] as String,
        phone: json['phone'] as String,
        countryCode: json['countryCode'] as String,
        state: json['state'] as String?,
        city: json['city'] as String,
        address: json['address'] as String,
        zipCode: json['zipCode'] as String?,
        isDefault: json['isDefault'] as bool? ?? false,
      );
}

/// What a create/update call sends — every field optional on update.
class AddressInput {
  const AddressInput({
    required this.recipientName,
    required this.phone,
    required this.countryCode,
    this.state,
    required this.city,
    required this.address,
    this.zipCode,
    this.isDefault,
  });

  final String recipientName;
  final String phone;
  final String countryCode;
  final String? state;
  final String city;
  final String address;
  final String? zipCode;
  final bool? isDefault;

  Map<String, dynamic> toJson() => {
        'recipientName': recipientName,
        'phone': phone,
        'countryCode': countryCode,
        if (state != null) 'state': state,
        'city': city,
        'address': address,
        if (zipCode != null) 'zipCode': zipCode,
        if (isDefault != null) 'isDefault': isDefault,
      };
}
