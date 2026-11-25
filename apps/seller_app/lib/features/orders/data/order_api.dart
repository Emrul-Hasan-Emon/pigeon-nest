import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/api/api_client.dart';
import '../../../shared/media/multipart_upload.dart';
import '../../../shared/paging/cursor_list_controller.dart';
import 'order_models.dart';

/// What the order list can be narrowed by. Empty means "no filter".
class OrderFilter {
  const OrderFilter({this.status, this.paymentStatus, this.search = ''});
  final String? status, paymentStatus;
  final String search;

  bool get active => status != null || paymentStatus != null;

  OrderFilter copyWith({String? status, String? paymentStatus, String? search, bool clearStatus = false, bool clearPayment = false}) => OrderFilter(
        status: clearStatus ? null : (status ?? this.status),
        paymentStatus: clearPayment ? null : (paymentStatus ?? this.paymentStatus),
        search: search ?? this.search,
      );

  Map<String, dynamic> toQuery() => {
        'status': ?status,
        'paymentStatus': ?paymentStatus,
        if (search.trim().isNotEmpty) ..._searchQuery(search.trim()),
      };

  /// Something that looks like an order number searches by number, anything else by customer.
  static Map<String, dynamic> _searchQuery(String q) => q.toUpperCase().startsWith('PN') ? {'orderNumber': q} : {'customerSearch': q};
}

final orderRepositoryProvider = Provider<OrderRepository>((ref) => OrderRepository(ref));

final orderDetailProvider = FutureProvider.autoDispose.family<OrderDetail, int>((ref, id) => ref.watch(orderRepositoryProvider).detail(id));

class BulkResult {
  BulkResult(Map<String, dynamic> j)
      : updated = (j['updated'] as num?)?.toInt() ?? 0,
        failed = (j['failed'] as num?)?.toInt() ?? 0,
        errors = [
          for (final r in (j['results'] as List? ?? const []))
            if ((r as Map)['ok'] == false) '${r['orderNumber']}: ${r['error']}',
        ];
  final int updated, failed;
  final List<String> errors;
}

class OrderRepository {
  OrderRepository(this._ref);
  final Ref _ref;

  ApiClient get _api => _ref.read(apiClientProvider);

  CursorFetcher<OrderRow> listFetcher(OrderFilter filter) => (cursor) async {
        final json = await _api.get<Map<String, dynamic>>('/order', query: {'limit': 20, ...filter.toQuery(), 'cursor': ?cursor});
        return CursorResult(
          items: [for (final r in (json['results'] as List)) OrderRow(r as Map<String, dynamic>)],
          nextCursor: json['nextCursor']?.toString(),
        );
      };

  Future<OrderDetail> detail(int id) async => OrderDetail(await _api.get<Map<String, dynamic>>('/order/$id'));

  Future<void> changeStatus(int id, String status, {String? note}) =>
      _api.patch<Object?>('/order/$id/status', body: {'status': status, if (note != null && note.trim().isNotEmpty) 'note': note.trim()});

  Future<BulkResult> bulkStatus(List<int> ids, String status, {String? note}) async => BulkResult(await _api.post<Map<String, dynamic>>(
        '/order/bulk-status',
        body: {'orderIds': ids, 'status': status, if (note != null && note.trim().isNotEmpty) 'note': note.trim()},
      ));

  Future<void> recordPayment(int id, {required String description, required List<XFile> files, double? amount, String? transactionId}) async {
    final body = await buildMultipart(
      fields: {
        'description': description.trim(),
        if (amount != null) 'amount': amount.toStringAsFixed(2),
        if (transactionId != null && transactionId.trim().isNotEmpty) 'transactionId': transactionId.trim(),
      },
      multiFiles: {'files': files},
    );
    await _api.post<Object?>('/order/$id/payments', body: body);
  }

  Future<void> reversePayment(int orderId, int paymentId, String reason) =>
      _api.post<Object?>('/order/$orderId/payments/$paymentId/reverse', body: {'reason': reason.trim()});

  Future<void> postUpdate(int id, {String? message, List<XFile> files = const []}) async {
    final body = await buildMultipart(
      fields: {if (message != null && message.trim().isNotEmpty) 'message': message.trim()},
      multiFiles: {'files': files},
    );
    await _api.post<Object?>('/order/$id/updates', body: body);
  }

  // ---- entering an order ----

  Future<List<FoundCustomer>> findCustomers(String q) async {
    final json = await _api.get<Map<String, dynamic>>('/order/customers', query: {'q': q});
    return [for (final c in (json['results'] as List)) FoundCustomer(c as Map<String, dynamic>)];
  }

  Future<List<SavedAddress>> addressesOf(int userId) async {
    final json = await _api.get<Map<String, dynamic>>('/order/customers/$userId/addresses');
    return [for (final a in (json['results'] as List)) SavedAddress(a as Map<String, dynamic>)];
  }

  Future<List<CatalogSku>> catalog(String search) async {
    final json = await _api.get<Map<String, dynamic>>('/order/catalog', query: {if (search.trim().isNotEmpty) 'search': search.trim()});
    return [
      for (final p in (json['results'] as List))
        for (final s in ((p as Map<String, dynamic>)['skus'] as List)) CatalogSku(s as Map<String, dynamic>, p['id'] as int, p['name'] as String),
    ];
  }

  Future<OrderOptions> options({String? countryCode, double? subtotal}) async =>
      OrderOptions(await _api.get<Map<String, dynamic>>('/order/options', query: {'countryCode': ?countryCode, 'subtotal': ?subtotal}));

  /// Returns the new order's id.
  Future<int> createOrder(Map<String, dynamic> body) async => (await _api.post<Map<String, dynamic>>('/order', body: body))['id'] as int;
}
