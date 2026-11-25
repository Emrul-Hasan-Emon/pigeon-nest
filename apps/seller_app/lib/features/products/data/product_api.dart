import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/api/api_client.dart';
import '../../../shared/media/multipart_upload.dart';
import '../../../shared/paging/cursor_list_controller.dart';
import 'product_models.dart';

class ProductFilter {
  const ProductFilter({this.status, this.activeStatus, this.search = ''});
  final String? status, activeStatus;
  final String search;

  ProductFilter copyWith({String? status, String? activeStatus, String? search, bool clearStatus = false, bool clearActive = false}) => ProductFilter(
        status: clearStatus ? null : (status ?? this.status),
        activeStatus: clearActive ? null : (activeStatus ?? this.activeStatus),
        search: search ?? this.search,
      );

  Map<String, dynamic> toQuery() => {
        'status': ?status,
        'activeStatus': ?activeStatus,
        if (search.trim().isNotEmpty) 'search': search.trim(),
      };
}

final productRepositoryProvider = Provider<ProductRepository>((ref) => ProductRepository(ref));

final productDetailProvider = FutureProvider.autoDispose.family<ProductDetail, int>((ref, id) => ref.watch(productRepositoryProvider).detail(id));

final productHistoryProvider = FutureProvider.autoDispose.family<List<StatusLine>, int>((ref, id) => ref.watch(productRepositoryProvider).history(id));

/// Categories, collections and attributes change rarely; fetched once per form.
final formLookupsProvider = FutureProvider.autoDispose<FormLookups>((ref) => ref.watch(productRepositoryProvider).lookups());

class BulkOutcome {
  BulkOutcome(Map<String, dynamic> j)
      : updated = (j['updated'] as num?)?.toInt() ?? 0,
        failed = (j['failed'] as num?)?.toInt() ?? 0,
        errors = [
          for (final r in (j['results'] as List? ?? const []))
            if ((r as Map)['ok'] == false) '${r['name'] ?? r['id']}: ${r['error']}',
        ];
  final int updated, failed;
  final List<String> errors;
}

class ProductRepository {
  ProductRepository(this._ref);
  final Ref _ref;

  ApiClient get _api => _ref.read(apiClientProvider);

  CursorFetcher<ProductRow> listFetcher(ProductFilter filter) => (cursor) async {
        final json = await _api.get<Map<String, dynamic>>('/products', query: {'limit': 20, ...filter.toQuery(), 'cursor': ?cursor});
        return CursorResult(
          items: [for (final r in (json['results'] as List)) ProductRow(r as Map<String, dynamic>)],
          nextCursor: json['nextCursor']?.toString(),
        );
      };

  Future<ProductDetail> detail(int id) async => ProductDetail(await _api.get<Map<String, dynamic>>('/products/$id'));

  Future<List<StatusLine>> history(int id) async {
    final json = await _api.get<Map<String, dynamic>>('/products/$id/status-history', query: {'limit': 50});
    return [for (final r in (json['results'] as List)) StatusLine(r as Map<String, dynamic>)];
  }

  Future<FormLookups> lookups() async {
    final tree = await _api.get<List<dynamic>>('/catalog/categories/tree');
    final collections = await _api.get<Map<String, dynamic>>('/catalog/collections', query: {'limit': 100});
    final attributes = await _api.get<Map<String, dynamic>>('/catalog/attributes', query: {'limit': 100});
    return FormLookups(
      flattenCategories(tree),
      [for (final c in (collections['results'] as List)) Collection(c as Map<String, dynamic>)],
      [for (final a in (attributes['results'] as List)) Attribute(a as Map<String, dynamic>)],
    );
  }

  /// Returns the new product's id.
  Future<int> create(Map<String, dynamic> body) async => (await _api.post<Map<String, dynamic>>('/products', body: body))['id'] as int;

  Future<void> update(int id, Map<String, dynamic> body) => _api.patch<Object?>('/products/$id', body: body);

  Future<void> setActive(int id, bool active) => update(id, {'activeStatus': active ? 'active' : 'inactive'});

  /// Returns the copy's id.
  Future<int> copy(int id) async => (await _api.post<Map<String, dynamic>>('/products/$id/copy'))['id'] as int;

  Future<BulkOutcome> bulk(List<int> ids, String action, {String? mode, String? direction, double? value}) async =>
      BulkOutcome(await _api.post<Map<String, dynamic>>('/products/bulk', body: {
        'productIds': ids,
        'action': action,
        'mode': ?mode,
        'direction': ?direction,
        'value': ?value,
      }));

  Future<void> updateMedia(int id, {XFile? thumbnail, bool removeThumbnail = false, List<XFile> add = const [], List<int> removeIds = const []}) async {
    final body = await buildMultipart(
      fields: {
        if (removeThumbnail) 'removeThumbnail': 'true',
        if (removeIds.isNotEmpty) 'removeMediaFilesIds': removeIds.join(','),
      },
      singleFiles: {'thumbnailImage': ?thumbnail},
      multiFiles: {if (add.isNotEmpty) 'mediaFiles': add},
    );
    await _api.patch<Object?>('/products/$id/media-files', body: body);
  }

  /// The API has no PUT helper, so the parent goes through the client's own `put`.
  Future<void> saveParent(int productId, int skuId, String role, {String? name, String? ringNumber, XFile? image}) async {
    final body = await buildMultipart(
      fields: {'name': name ?? '', 'ringNumber': ringNumber ?? ''},
      singleFiles: {'image': ?image},
    );
    await _api.put<Object?>('/products/$productId/skus/$skuId/parents/$role', body: body);
  }
}
