import '../../../core/config/app_config.dart';

String? _media(String? url) => url == null ? null : AppConfig.mediaUrl(url);

const kProposalActions = ['accept', 'counter', 'reject', 'cancel'];

class Proposal {
  Proposal({
    required this.id,
    required this.status,
    required this.awaitingParty,
    required this.quantity,
    required this.price,
    required this.total,
    required this.skuPriceNow,
    required this.productName,
    required this.productThumbnailUrl,
    required this.skuLabel,
    required this.sellerName,
    required this.createdAt,
    required this.actions,
  });
  final int id;
  final String status;
  final String? awaitingParty;
  final int quantity;
  final num price;
  final num total;
  final num skuPriceNow;
  final String productName;
  final String? productThumbnailUrl;
  final String? skuLabel;
  final String sellerName;
  final DateTime createdAt;
  final List<String> actions;

  bool get awaitingMe => awaitingParty == 'buyer';

  factory Proposal.fromJson(Map<String, dynamic> json) {
    final product = json['product'] as Map<String, dynamic>;
    final sku = json['sku'] as Map<String, dynamic>;
    final seller = json['seller'] as Map<String, dynamic>;
    return Proposal(
      id: json['id'] as int,
      status: json['status'] as String,
      awaitingParty: json['awaitingParty'] as String?,
      quantity: json['quantity'] as int,
      price: json['price'] as num,
      total: json['total'] as num,
      skuPriceNow: json['skuPriceNow'] as num,
      productName: product['name'] as String,
      productThumbnailUrl: _media(product['thumbnailUrl'] as String?),
      skuLabel: sku['label'] as String?,
      sellerName: seller['name'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      actions: (json['actions'] as List).cast<String>(),
    );
  }
}

class ProposalHistoryEntry {
  ProposalHistoryEntry({required this.action, required this.actorName, required this.price, required this.quantity, required this.note, required this.createdAt});
  final String action;
  final String? actorName;
  final num price;
  final int quantity;
  final String? note;
  final DateTime createdAt;

  factory ProposalHistoryEntry.fromJson(Map<String, dynamic> json) => ProposalHistoryEntry(
        action: json['action'] as String,
        actorName: json['actorName'] as String?,
        price: json['price'] as num,
        quantity: json['quantity'] as int,
        note: json['note'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}

class ProposalDetail extends Proposal {
  ProposalDetail({
    required super.id,
    required super.status,
    required super.awaitingParty,
    required super.quantity,
    required super.price,
    required super.total,
    required super.skuPriceNow,
    required super.productName,
    required super.productThumbnailUrl,
    required super.skuLabel,
    required super.sellerName,
    required super.createdAt,
    required super.actions,
    required this.history,
  });
  final List<ProposalHistoryEntry> history;

  factory ProposalDetail.fromJson(Map<String, dynamic> json) {
    final base = Proposal.fromJson(json);
    return ProposalDetail(
      id: base.id,
      status: base.status,
      awaitingParty: base.awaitingParty,
      quantity: base.quantity,
      price: base.price,
      total: base.total,
      skuPriceNow: base.skuPriceNow,
      productName: base.productName,
      productThumbnailUrl: base.productThumbnailUrl,
      skuLabel: base.skuLabel,
      sellerName: base.sellerName,
      createdAt: base.createdAt,
      actions: base.actions,
      history: (json['history'] as List).cast<Map<String, dynamic>>().map(ProposalHistoryEntry.fromJson).toList(),
    );
  }
}
