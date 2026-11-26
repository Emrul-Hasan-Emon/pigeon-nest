import '../../../core/config/app_config.dart';

String? _media(String? url) => url == null ? null : AppConfig.mediaUrl(url);

/// One page of a page-number list, as every storefront list endpoint returns it.
class PageResult<T> {
  const PageResult({required this.results, required this.page, required this.totalPages});

  final List<T> results;
  final int page;
  final int totalPages;

  factory PageResult.fromJson(Map<String, dynamic> json, T Function(Map<String, dynamic>) item) {
    return PageResult(
      results: (json['results'] as List).cast<Map<String, dynamic>>().map(item).toList(),
      page: json['page'] as int,
      totalPages: json['totalPages'] as int,
    );
  }
}

class StoreBanner {
  StoreBanner({required this.id, required this.title, required this.imageUrl, required this.linkUrl});
  final int id;
  final String title;
  final String? imageUrl;
  final String? linkUrl;

  factory StoreBanner.fromJson(Map<String, dynamic> json) => StoreBanner(
        id: json['id'] as int,
        title: json['title'] as String,
        imageUrl: _media(json['imageUrl'] as String?),
        linkUrl: json['linkUrl'] as String?,
      );
}

class StoreCategory {
  StoreCategory({required this.id, required this.name, required this.slug, required this.imageUrl});
  final int id;
  final String name;
  final String slug;
  final String? imageUrl;

  factory StoreCategory.fromJson(Map<String, dynamic> json) => StoreCategory(
        id: json['id'] as int,
        name: json['name'] as String,
        slug: json['slug'] as String,
        imageUrl: _media(json['imageUrl'] as String?),
      );
}

class CategoryNode extends StoreCategory {
  CategoryNode({required super.id, required super.name, required super.slug, required super.imageUrl, required this.children});
  final List<CategoryNode> children;

  factory CategoryNode.fromJson(Map<String, dynamic> json) => CategoryNode(
        id: json['id'] as int,
        name: json['name'] as String,
        slug: json['slug'] as String,
        imageUrl: _media(json['imageUrl'] as String?),
        children: (json['children'] as List? ?? []).cast<Map<String, dynamic>>().map(CategoryNode.fromJson).toList(),
      );
}

class Crumb {
  Crumb({required this.id, required this.name, required this.slug});
  final int id;
  final String name;
  final String slug;

  factory Crumb.fromJson(Map<String, dynamic> json) => Crumb(id: json['id'] as int, name: json['name'] as String, slug: json['slug'] as String);
}

class StoreCategoryDetail {
  StoreCategoryDetail({required this.id, required this.name, required this.slug, required this.description, required this.imageUrl, required this.breadcrumb, required this.children});
  final int id;
  final String name;
  final String slug;
  final String? description;
  final String? imageUrl;
  final List<Crumb> breadcrumb;
  final List<StoreCategory> children;

  factory StoreCategoryDetail.fromJson(Map<String, dynamic> json) => StoreCategoryDetail(
        id: json['id'] as int,
        name: json['name'] as String,
        slug: json['slug'] as String,
        description: json['description'] as String?,
        imageUrl: _media(json['imageUrl'] as String?),
        breadcrumb: (json['breadcrumb'] as List).cast<Map<String, dynamic>>().map(Crumb.fromJson).toList(),
        children: (json['children'] as List).cast<Map<String, dynamic>>().map(StoreCategory.fromJson).toList(),
      );
}

class StoreCollection {
  StoreCollection({required this.id, required this.name, required this.slug, required this.imageUrl, required this.colorCode});
  final int id;
  final String name;
  final String slug;
  final String? imageUrl;
  final String? colorCode;

  factory StoreCollection.fromJson(Map<String, dynamic> json) => StoreCollection(
        id: json['id'] as int,
        name: json['name'] as String,
        slug: json['slug'] as String,
        imageUrl: _media(json['imageUrl'] as String?),
        colorCode: json['colorCode'] as String?,
      );
}

class StoreCollectionDetail extends StoreCollection {
  StoreCollectionDetail({required super.id, required super.name, required super.slug, required super.imageUrl, required super.colorCode, required this.description});
  final String? description;

  factory StoreCollectionDetail.fromJson(Map<String, dynamic> json) => StoreCollectionDetail(
        id: json['id'] as int,
        name: json['name'] as String,
        slug: json['slug'] as String,
        imageUrl: _media(json['imageUrl'] as String?),
        colorCode: json['colorCode'] as String?,
        description: json['description'] as String?,
      );
}

class StoreProduct {
  StoreProduct({
    required this.id,
    required this.name,
    required this.slug,
    required this.thumbnailUrl,
    required this.price,
    required this.discountedPrice,
    required this.ratingAverage,
    required this.ratingCount,
    required this.sellerName,
    required this.breed,
    required this.bloodline,
  });
  final int id;
  final String name;
  final String slug;
  final String? thumbnailUrl;
  final num? price;
  final num? discountedPrice;
  final num ratingAverage;
  final int ratingCount;
  final String? sellerName;
  final String? breed;
  final String? bloodline;

  num? get effectivePrice => discountedPrice ?? price;

  factory StoreProduct.fromJson(Map<String, dynamic> json) => StoreProduct(
        id: json['id'] as int,
        name: json['name'] as String,
        slug: json['slug'] as String,
        thumbnailUrl: _media(json['thumbnailUrl'] as String?),
        price: json['price'] as num?,
        discountedPrice: json['discountedPrice'] as num?,
        ratingAverage: (json['ratingAverage'] as num?) ?? 0,
        ratingCount: (json['ratingCount'] as num?)?.toInt() ?? 0,
        sellerName: (json['seller'] as Map<String, dynamic>?)?['name'] as String?,
        breed: json['breed'] as String?,
        bloodline: json['bloodline'] as String?,
      );
}

class BirdFilters {
  BirdFilters({required this.breeds, required this.bloodlines});
  final List<String> breeds;
  final List<String> bloodlines;

  factory BirdFilters.fromJson(Map<String, dynamic> json) => BirdFilters(
        breeds: (json['breeds'] as List).map((e) => (e as Map<String, dynamic>)['name'] as String).toList(),
        bloodlines: (json['bloodlines'] as List).map((e) => (e as Map<String, dynamic>)['name'] as String).toList(),
      );
}

/// Everything a homepage section can show. Only the fields its sectionType uses are non-null.
class HomepageSection {
  HomepageSection({required this.id, required this.title, required this.sectionType, required this.layout, required this.items});
  final int id;
  final String title;
  final String sectionType;
  final String layout;
  final List<Map<String, dynamic>> items;

  factory HomepageSection.fromJson(Map<String, dynamic> json) => HomepageSection(
        id: json['id'] as int,
        title: json['title'] as String,
        sectionType: json['sectionType'] as String,
        layout: json['layout'] as String,
        items: (json['items'] as List).cast<Map<String, dynamic>>(),
      );
}

const kProductSectionTypes = {'category_products', 'collection_products', 'specific_products', 'featured_products'};

class StoreHomepage {
  StoreHomepage({required this.sections});
  final List<HomepageSection> sections;

  factory StoreHomepage.fromJson(Map<String, dynamic> json) => StoreHomepage(
        sections: (json['sections'] as List).cast<Map<String, dynamic>>().map(HomepageSection.fromJson).toList(),
      );
}

class SellerCard {
  SellerCard({required this.id, required this.name, required this.avatarUrl, required this.productCount});
  final int id;
  final String name;
  final String? avatarUrl;
  final int productCount;

  factory SellerCard.fromJson(Map<String, dynamic> json) => SellerCard(
        id: json['id'] as int,
        name: json['name'] as String,
        avatarUrl: _media(json['avatarUrl'] as String?),
        productCount: (json['productCount'] as num?)?.toInt() ?? 0,
      );
}

class SellerDetails extends SellerCard {
  SellerDetails({required super.id, required super.name, required super.avatarUrl, required super.productCount, required this.description, required this.ratingAverage, required this.ratingCount});
  final String? description;
  final num ratingAverage;
  final int ratingCount;

  factory SellerDetails.fromJson(Map<String, dynamic> json) => SellerDetails(
        id: json['id'] as int,
        name: json['name'] as String,
        avatarUrl: _media(json['avatarUrl'] as String?),
        productCount: (json['productCount'] as num?)?.toInt() ?? 0,
        description: json['description'] as String?,
        ratingAverage: (json['ratingAverage'] as num?) ?? 0,
        ratingCount: (json['ratingCount'] as num?)?.toInt() ?? 0,
      );
}

class ProductOptionValue {
  ProductOptionValue({required this.id, required this.name, required this.colorCode});
  final int id;
  final String name;
  final String? colorCode;

  factory ProductOptionValue.fromJson(Map<String, dynamic> json) =>
      ProductOptionValue(id: json['id'] as int, name: json['name'] as String, colorCode: json['colorCode'] as String?);
}

class ProductOption {
  ProductOption({required this.attributeId, required this.name, required this.values});
  final int attributeId;
  final String name;
  final List<ProductOptionValue> values;

  factory ProductOption.fromJson(Map<String, dynamic> json) => ProductOption(
        attributeId: json['attributeId'] as int,
        name: json['name'] as String,
        values: (json['values'] as List).cast<Map<String, dynamic>>().map(ProductOptionValue.fromJson).toList(),
      );
}

class SkuVariant {
  SkuVariant({required this.attributeId, required this.valueId});
  final int attributeId;
  final int valueId;

  factory SkuVariant.fromJson(Map<String, dynamic> json) => SkuVariant(attributeId: json['attributeId'] as int, valueId: json['valueId'] as int);
}

class ProductSku {
  ProductSku({
    required this.id,
    required this.sku,
    required this.imageUrl,
    required this.price,
    required this.discountedPrice,
    required this.effectivePrice,
    required this.quantity,
    required this.inStock,
    required this.isDefault,
    required this.acceptProposals,
    required this.variants,
  });
  final int id;
  final String sku;
  final String? imageUrl;
  final num price;
  final num? discountedPrice;
  final num effectivePrice;
  final int quantity;
  final bool inStock;
  final bool isDefault;
  final bool acceptProposals;
  final List<SkuVariant> variants;

  factory ProductSku.fromJson(Map<String, dynamic> json) => ProductSku(
        id: json['id'] as int,
        sku: json['sku'] as String,
        imageUrl: _media(json['imageUrl'] as String?),
        price: json['price'] as num,
        discountedPrice: json['discountedPrice'] as num?,
        effectivePrice: json['effectivePrice'] as num,
        quantity: (json['quantity'] as num?)?.toInt() ?? 0,
        inStock: json['inStock'] as bool? ?? false,
        acceptProposals: json['acceptProposals'] as bool? ?? false,
        isDefault: json['isDefault'] as bool? ?? false,
        variants: (json['variants'] as List).cast<Map<String, dynamic>>().map(SkuVariant.fromJson).toList(),
      );

  int? valueFor(int attributeId) => variants.where((v) => v.attributeId == attributeId).map((v) => v.valueId).firstOrNull;
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}

class ProductMedia {
  ProductMedia({required this.id, required this.url, required this.isPrimary});
  final int id;
  final String url;
  final bool isPrimary;

  factory ProductMedia.fromJson(Map<String, dynamic> json) =>
      ProductMedia(id: json['id'] as int, url: _media(json['url'] as String) ?? json['url'] as String, isPrimary: json['isPrimary'] as bool? ?? false);
}

class ProductDetail {
  ProductDetail({
    required this.id,
    required this.name,
    required this.description,
    required this.ratingAverage,
    required this.ratingCount,
    required this.breed,
    required this.bloodline,
    required this.breadcrumb,
    required this.seller,
    required this.sellerId,
    required this.sellerProductCount,
    required this.options,
    required this.skus,
    required this.media,
    required this.related,
  });
  final int id;
  final String name;
  final String? description;
  final num ratingAverage;
  final int ratingCount;
  final String? breed;
  final String? bloodline;
  final List<Crumb> breadcrumb;
  final String seller;
  final int sellerId;
  final int sellerProductCount;
  final List<ProductOption> options;
  final List<ProductSku> skus;
  final List<ProductMedia> media;
  final List<StoreProduct> related;

  factory ProductDetail.fromJson(Map<String, dynamic> json) {
    final bird = json['bird'] as Map<String, dynamic>?;
    final sellerJson = json['seller'] as Map<String, dynamic>;
    return ProductDetail(
      id: json['id'] as int,
      name: json['name'] as String,
      description: json['description'] as String?,
      ratingAverage: (json['ratingAverage'] as num?) ?? 0,
      ratingCount: (json['ratingCount'] as num?)?.toInt() ?? 0,
      breed: bird?['breed'] as String?,
      bloodline: bird?['bloodline'] as String?,
      breadcrumb: (json['breadcrumb'] as List).cast<Map<String, dynamic>>().map(Crumb.fromJson).toList(),
      seller: sellerJson['name'] as String,
      sellerId: sellerJson['id'] as int,
      sellerProductCount: (sellerJson['productCount'] as num?)?.toInt() ?? 0,
      options: (json['options'] as List).cast<Map<String, dynamic>>().map(ProductOption.fromJson).toList(),
      skus: (json['skus'] as List).cast<Map<String, dynamic>>().map(ProductSku.fromJson).toList(),
      media: (json['media'] as List).cast<Map<String, dynamic>>().map(ProductMedia.fromJson).toList(),
      related: (json['related'] as List).cast<Map<String, dynamic>>().map(StoreProduct.fromJson).toList(),
    );
  }
}

enum ProductSort { newest, priceAsc, priceDesc, nameAsc }

extension ProductSortKey on ProductSort {
  String get key => switch (this) {
        ProductSort.newest => 'newest',
        ProductSort.priceAsc => 'priceAsc',
        ProductSort.priceDesc => 'priceDesc',
        ProductSort.nameAsc => 'nameAsc',
      };
  String get label => switch (this) {
        ProductSort.newest => 'Newest',
        ProductSort.priceAsc => 'Price: low to high',
        ProductSort.priceDesc => 'Price: high to low',
        ProductSort.nameAsc => 'Name',
      };
}

class ProductQuery {
  const ProductQuery({this.search, this.categoryId, this.collectionId, this.sellerId, this.featured, this.breed, this.bloodline, this.sort = ProductSort.newest});
  final String? search;
  final int? categoryId;
  final int? collectionId;
  final int? sellerId;
  final bool? featured;
  final String? breed;
  final String? bloodline;
  final ProductSort sort;

  Map<String, dynamic> toQuery(int page) => {
        'page': page,
        if (search != null && search!.isNotEmpty) 'search': search,
        if (categoryId != null) 'categoryId': categoryId,
        if (categoryId != null) 'includeSubcategories': true,
        if (collectionId != null) 'collectionId': collectionId,
        if (sellerId != null) 'sellerId': sellerId,
        if (featured != null) 'featured': featured,
        if (breed != null) 'breed': breed,
        if (bloodline != null) 'bloodline': bloodline,
        'sort': sort.key,
      };

  ProductQuery copyWith({String? search, String? breed, String? bloodline, ProductSort? sort}) => ProductQuery(
        search: search ?? this.search,
        categoryId: categoryId,
        collectionId: collectionId,
        sellerId: sellerId,
        featured: featured,
        breed: breed ?? this.breed,
        bloodline: bloodline ?? this.bloodline,
        sort: sort ?? this.sort,
      );
}
