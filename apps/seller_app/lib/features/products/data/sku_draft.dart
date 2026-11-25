import 'product_models.dart';

String _money(double v) => v.toStringAsFixed(2);

/// One option (SKU) while it is being typed. Holds plain values; the editor screen turns them into fields.
class SkuDraft {
  SkuDraft({
    this.id,
    this.code = '',
    this.price = '',
    this.offerPrice = '',
    this.quantity = '0',
    this.lowStock = '3',
    this.buyPrice = '',
    this.ring = '',
    this.hatch = '',
    this.vaccine = '',
    this.vaccinatedOn = '',
    this.minProposal = '',
    this.isDefault = false,
    this.isActive = true,
    this.acceptProposals = false,
    List<(int, int, String)>? variants,
    this.original,
  }) : variants = variants ?? [];

  /// Null for an option that is not saved yet.
  final int? id;
  final Sku? original;
  String code, price, offerPrice, quantity, lowStock, buyPrice, ring, hatch, vaccine, vaccinatedOn, minProposal;
  bool isDefault, isActive, acceptProposals;

  /// (attributeId, valueId, "Gender: Male"). Fixed once the option is saved.
  List<(int, int, String)> variants;

  bool get isNew => id == null;

  factory SkuDraft.fromSku(Sku s) => SkuDraft(
        id: s.id,
        original: s,
        code: s.code ?? '',
        price: _money(s.price),
        offerPrice: s.onOffer ? _money(s.discountedPrice) : '',
        quantity: '${s.quantity}',
        lowStock: '${s.lowStockThreshold}',
        buyPrice: s.myBuyingPrice == null ? '' : _money(s.myBuyingPrice!),
        ring: s.ringNumber ?? '',
        hatch: s.hatchDate ?? '',
        vaccine: s.vaccineName ?? '',
        vaccinatedOn: s.vaccinatedOn ?? '',
        minProposal: s.minProposalPrice > 0 ? _money(s.minProposalPrice) : '',
        isDefault: s.isDefault,
        isActive: s.isActive,
        acceptProposals: s.acceptProposals,
        variants: [for (final v in s.variants) (v.attributeId, v.attributeValueId, '${v.attributeName}: ${v.valueName}')],
      );

  SkuDraft copy() => SkuDraft(
        id: id,
        original: original,
        code: code,
        price: price,
        offerPrice: offerPrice,
        quantity: quantity,
        lowStock: lowStock,
        buyPrice: buyPrice,
        ring: ring,
        hatch: hatch,
        vaccine: vaccine,
        vaccinatedOn: vaccinatedOn,
        minProposal: minProposal,
        isDefault: isDefault,
        isActive: isActive,
        acceptProposals: acceptProposals,
        variants: [...variants],
      );

  String get label => variants.isEmpty ? (code.isEmpty ? 'New option' : code) : variants.map((v) => v.$3).join(' / ');

  double? get priceValue => double.tryParse(price.trim());

  /// Fields shared by create and update. Bird facts go as "" when empty, which clears them on the server.
  Map<String, dynamic> _common() {
    double? n(String s) => s.trim().isEmpty ? null : double.tryParse(s.trim());
    final p = n(price)!;
    final offer = n(offerPrice);
    return {
      'price': p,
      // An empty offer price means "no offer": the server treats it as the normal price.
      'discountedPrice': offer ?? p,
      'quantity': int.tryParse(quantity.trim()) ?? 0,
      'lowStockThreshold': int.tryParse(lowStock.trim()) ?? 3,
      if (n(buyPrice) != null) 'myBuyingPrice': n(buyPrice),
      'isDefault': isDefault,
      'isActive': isActive,
      'acceptProposals': acceptProposals,
      if (acceptProposals && n(minProposal) != null) 'minProposalPrice': n(minProposal),
      'ringNumber': ring.trim(),
      'hatchDate': hatch.trim(),
      'vaccineName': vaccine.trim(),
      'vaccinatedOn': vaccinatedOn.trim(),
    };
  }

  Map<String, dynamic> toCreateJson() => {
        ..._common(),
        if (code.trim().isNotEmpty) 'sku': code.trim(),
        'variants': [for (final v in variants) {'attributeId': v.$1, 'attributeValueId': v.$2}],
      };

  /// Saved options keep their code and variants; only the rest is sent.
  Map<String, dynamic> toUpdateJson() => {'id': id, ..._common()};

  /// Why this option cannot be saved yet, or null.
  String? problem() {
    if (variants.isEmpty) return 'Pick at least one choice (for example Gender: Male).';
    final p = double.tryParse(price.trim());
    if (p == null || p < 0) return 'Enter a price.';
    final o = offerPrice.trim().isEmpty ? null : double.tryParse(offerPrice.trim());
    if (offerPrice.trim().isNotEmpty && (o == null || o < 0)) return 'The offer price is not a number.';
    if (o != null && o > p) return 'The offer price cannot be above the price.';
    if (int.tryParse(quantity.trim()) == null) return 'Stock must be a whole number.';
    return null;
  }
}
