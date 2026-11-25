double _d(Object? v) => (v as num?)?.toDouble() ?? 0;
double? _dn(Object? v) => (v as num?)?.toDouble();
int _i(Object? v) => (v as num?)?.toInt() ?? 0;
String? _s(Object? v) => (v is String && v.isNotEmpty) ? v : null;
Map<String, dynamic> _m(Object? v) => (v as Map<String, dynamic>?) ?? const {};
List<Map<String, dynamic>> _l(Object? v) => [for (final e in (v as List? ?? const [])) e as Map<String, dynamic>];
DateTime _t(Object? v) => DateTime.tryParse(v as String? ?? '') ?? DateTime.fromMillisecondsSinceEpoch(0);

String productStatusLabel(String s) => s.isEmpty ? s : s[0].toUpperCase() + s.substring(1).replaceAll('_', ' ');

/// "5 months old", "1 year 2 months old", "12 days old". Empty without a hatch date.
String ageText(String? hatchDate, {DateTime? today}) {
  if (hatchDate == null) return '';
  final p = hatchDate.split('-').map(int.tryParse).toList();
  if (p.length != 3 || p.contains(null)) return '';
  final now = today ?? DateTime.now();
  var months = (now.year - p[0]!) * 12 + (now.month - p[1]!);
  if (now.day < p[2]!) months -= 1;
  if (months < 0) return '';
  if (months == 0) {
    final days = now.difference(DateTime(p[0]!, p[1]!, p[2]!)).inDays.clamp(0, 1 << 30);
    return '$days ${days == 1 ? 'day' : 'days'} old';
  }
  final years = months ~/ 12, rest = months % 12;
  final parts = [
    if (years > 0) '$years ${years == 1 ? 'year' : 'years'}',
    if (rest > 0) '$rest ${rest == 1 ? 'month' : 'months'}',
  ];
  return '${parts.join(' ')} old';
}

class ProductRow {
  ProductRow(Map<String, dynamic> j)
      : id = _i(j['id']),
        name = j['name'] as String? ?? '',
        thumbnailUrl = _s(j['thumbnailUrl']),
        status = j['status'] as String? ?? '',
        activeStatus = j['activeStatus'] as String? ?? '',
        breed = _s(j['breed']),
        wishlistCount = _i(j['wishlistCount']),
        ratingAverage = _d(j['ratingAverage']),
        ratingCount = _i(j['ratingCount']),
        categoryName = _s(_m(j['category'])['name']),
        updatedAt = _t(j['updatedAt']);

  final int id, wishlistCount, ratingCount;
  final String name, status, activeStatus;
  final String? thumbnailUrl, breed, categoryName;
  final double ratingAverage;
  final DateTime updatedAt;

  /// Rejected or suspended products are frozen: no edits, only copying.
  bool get locked => status == 'rejected' || activeStatus == 'suspended';
  bool get isActive => activeStatus == 'active';
}

class Variant {
  Variant(Map<String, dynamic> j)
      : attributeId = _i(j['attributeId']),
        attributeValueId = _i(j['attributeValueId']),
        attributeName = _s(_m(j['attribute'])['name']) ?? '',
        valueName = _s(_m(j['attributeValue'])['name']) ?? '';
  final int attributeId, attributeValueId;
  final String attributeName, valueName;
}

class Parent {
  Parent(Map<String, dynamic> j)
      : role = j['role'] as String? ?? '',
        name = _s(j['name']),
        ringNumber = _s(j['ringNumber']),
        imageUrl = _s(j['imageUrl']);
  final String role;
  final String? name, ringNumber, imageUrl;
}

class Sku {
  Sku(Map<String, dynamic> j)
      : id = _i(j['id']),
        code = _s(j['sku']),
        description = _s(j['description']),
        quantity = _i(j['quantity']),
        lowStockThreshold = _i(j['lowStockThreshold']),
        myBuyingPrice = _dn(j['myBuyingPrice']),
        price = _d(j['price']),
        discountedPrice = _d(j['discountedPrice']),
        discountStart = _s(j['discountedPriceStartDate']),
        discountEnd = _s(j['discountedPriceEndDate']),
        isDefault = j['isDefault'] as bool? ?? false,
        isActive = j['isActive'] as bool? ?? true,
        acceptProposals = j['acceptProposals'] as bool? ?? false,
        minProposalPrice = _d(j['minProposalPrice']),
        ringNumber = _s(j['ringNumber']),
        hatchDate = _s(j['hatchDate']),
        vaccineName = _s(j['vaccineName']),
        vaccinatedOn = _s(j['vaccinatedOn']),
        variants = [for (final v in _l(j['variants'])) Variant(v)],
        parents = [for (final p in _l(j['parents'])) Parent(p)];

  final int id, quantity, lowStockThreshold;
  final String? code, description, discountStart, discountEnd, ringNumber, hatchDate, vaccineName, vaccinatedOn;
  final double? myBuyingPrice;
  final double price, discountedPrice, minProposalPrice;
  final bool isDefault, isActive, acceptProposals;
  final List<Variant> variants;
  final List<Parent> parents;

  String get label => variants.isEmpty ? (code ?? 'Default') : variants.map((v) => '${v.attributeName}: ${v.valueName}').join(' / ');
  bool get onOffer => discountedPrice > 0 && discountedPrice < price;
  double get payable => discountedPrice > 0 ? discountedPrice : price;
  Parent? parent(String role) => parents.where((p) => p.role == role).firstOrNull;
}

class MediaItem {
  MediaItem(Map<String, dynamic> j)
      : id = _i(j['id']),
        url = j['url'] as String? ?? '',
        type = j['type'] as String? ?? 'image';
  final int id;
  final String url, type;
  bool get isImage => type == 'image';
}

class ProductDetail {
  ProductDetail(Map<String, dynamic> j)
      : row = ProductRow(j),
        categoryId = _i(j['categoryId']),
        collectionId = j['collectionId'] as int?,
        collectionName = _s(_m(j['collection'])['name']),
        description = _s(j['description']),
        seoTitle = _s(j['seoTitle']),
        seoDescription = _s(j['seoDescription']),
        rejectionReason = _s(j['rejectionReason']),
        suspensionReason = _s(j['suspensionReason']),
        bloodline = _s(j['bloodline']),
        bloodlineNote = _s(j['bloodlineNote']),
        vaccinationNote = _s(j['vaccinationNote']),
        healthNote = _s(j['healthNote']),
        raceRecord = _s(j['raceRecord']),
        skus = [for (final s in _l(j['skus'])) Sku(s)],
        media = [for (final m in _l(j['media'])) MediaItem(m)];

  final ProductRow row;
  final int categoryId;
  final int? collectionId;
  final String? collectionName, description, seoTitle, seoDescription, rejectionReason, suspensionReason;
  final String? bloodline, bloodlineNote, vaccinationNote, healthNote, raceRecord;
  final List<Sku> skus;
  final List<MediaItem> media;

  String? get lockReason => row.status == 'rejected' ? rejectionReason : (row.activeStatus == 'suspended' ? suspensionReason : null);
  bool get hasBirdFacts => [row.breed, bloodline, bloodlineNote, vaccinationNote, healthNote, raceRecord].any((v) => v != null);
}

class StatusLine {
  StatusLine(Map<String, dynamic> j)
      : action = j['action'] as String? ?? '',
        toStatus = j['toStatus'] as String? ?? '',
        toActiveStatus = j['toActiveStatus'] as String? ?? '',
        reason = _s(j['reason']),
        by = _s(j['creatorName']),
        at = _t(j['createdAt']);
  final String action, toStatus, toActiveStatus;
  final String? reason, by;
  final DateTime at;
}

class Category {
  Category(this.id, this.name, this.path);
  final int id;
  final String name, path;
}

/// Flattens the category tree into "Electronics > Mobiles" rows.
List<Category> flattenCategories(List<dynamic> tree, [String prefix = '']) {
  final out = <Category>[];
  for (final n in tree) {
    final m = n as Map<String, dynamic>;
    final path = prefix.isEmpty ? m['name'] as String : '$prefix > ${m['name']}';
    out.add(Category(_i(m['id']), m['name'] as String, path));
    out.addAll(flattenCategories(m['children'] as List? ?? const [], path));
  }
  return out;
}

class Collection {
  Collection(Map<String, dynamic> j)
      : id = _i(j['id']),
        name = j['name'] as String? ?? '';
  final int id;
  final String name;
}

class AttributeValue {
  AttributeValue(Map<String, dynamic> j)
      : id = _i(j['id']),
        name = j['name'] as String? ?? '';
  final int id;
  final String name;
}

class Attribute {
  Attribute(Map<String, dynamic> j)
      : id = _i(j['id']),
        name = j['name'] as String? ?? '',
        values = [for (final v in _l(j['values'])) AttributeValue(v)];
  final int id;
  final String name;
  final List<AttributeValue> values;
}

/// What the product form needs to offer: categories, collections and attributes.
class FormLookups {
  FormLookups(this.categories, this.collections, this.attributes);
  final List<Category> categories;
  final List<Collection> collections;
  final List<Attribute> attributes;
}
