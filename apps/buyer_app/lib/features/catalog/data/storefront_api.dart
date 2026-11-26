import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import 'storefront_models.dart';

final storefrontApiProvider = Provider<StorefrontApi>((ref) => StorefrontApi(ref.read(apiClientProvider)));

/// Every server path this feature uses, in one place (rule 6 in root `rules.md`).
class StorefrontApi {
  StorefrontApi(this._client);
  final ApiClient _client;

  Future<StoreHomepage> homepage() async {
    final json = await _client.get<Map<String, dynamic>>('/homepage', query: {'device': 'mobile', 'page': 'main'});
    return StoreHomepage.fromJson(json);
  }

  Future<List<CategoryNode>> categoryTree() async {
    final json = await _client.get<List<dynamic>>('/categories/tree');
    return json.cast<Map<String, dynamic>>().map(CategoryNode.fromJson).toList();
  }

  Future<StoreCategoryDetail> category(String slug) async {
    final json = await _client.get<Map<String, dynamic>>('/categories/$slug');
    return StoreCategoryDetail.fromJson(json);
  }

  Future<PageResult<StoreCollection>> collections(int page) async {
    final json = await _client.get<Map<String, dynamic>>('/collections', query: {'page': page, 'pageSize': 50});
    return PageResult.fromJson(json, StoreCollection.fromJson);
  }

  Future<StoreCollectionDetail> collection(String slug) async {
    final json = await _client.get<Map<String, dynamic>>('/collections/$slug');
    return StoreCollectionDetail.fromJson(json);
  }

  Future<PageResult<StoreProduct>> products(ProductQuery query, int page) async {
    final json = await _client.get<Map<String, dynamic>>('/products', query: query.toQuery(page));
    return PageResult.fromJson(json, StoreProduct.fromJson);
  }

  Future<BirdFilters> birdFilters() async {
    final json = await _client.get<Map<String, dynamic>>('/products/bird-filters');
    return BirdFilters.fromJson(json);
  }

  Future<ProductDetail> product(int id) async {
    final json = await _client.get<Map<String, dynamic>>('/products/$id');
    return ProductDetail.fromJson(json);
  }

  Future<PageResult<SellerCard>> sellers({String? search, String sort = 'newest', required int page}) async {
    final json = await _client.get<Map<String, dynamic>>('/sellers', query: {
      'page': page,
      if (search != null && search.isNotEmpty) 'search': search,
      'sort': sort,
    });
    return PageResult.fromJson(json, SellerCard.fromJson);
  }

  Future<SellerDetails> seller(int id) async {
    final json = await _client.get<Map<String, dynamic>>('/sellers/$id');
    return SellerDetails.fromJson(json);
  }
}
