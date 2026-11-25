import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/api/api_client.dart';
import '../../../shared/media/multipart_upload.dart';
import '../../../shared/paging/page_list_controller.dart';
import 'return_models.dart';

final returnsApiProvider = Provider<ReturnsApi>((ref) => ReturnsApi(ref));

final returnDetailProvider = FutureProvider.autoDispose.family<ReturnDetail, int>((ref, id) => ref.watch(returnsApiProvider).detail(id));
final refundDetailProvider = FutureProvider.autoDispose.family<RefundRecord, int>((ref, id) => ref.watch(returnsApiProvider).refund(id));
final refundSummaryProvider = FutureProvider.autoDispose<Map<String, int>>((ref) => ref.watch(returnsApiProvider).refundSummary());

/// Returns on the seller's orders, and the refunds of their cancelled orders.
class ReturnsApi {
  ReturnsApi(this._ref);
  final Ref _ref;
  ApiClient get _api => _ref.read(apiClientProvider);

  PageFetcher<ReturnRow> returnsFetcher({String? status, String search = ''}) => (page) async {
        final json = await _api.get<Map<String, dynamic>>('/returns', query: {
          'page': page,
          'pageSize': 20,
          'status': ?status,
          if (search.trim().isNotEmpty) 'search': search.trim(),
        });
        return _page(json, (r) => ReturnRow(r));
      };

  Future<ReturnDetail> detail(int id) async => ReturnDetail(await _api.get<Map<String, dynamic>>('/returns/$id'));

  /// [step]: accept, reject, processing. Reject needs a note.
  Future<void> step(int id, String step, {String? note, bool? includeDeliveryCharge}) => _api.post<Object?>('/returns/$id/$step', body: {
        if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
        'includeDeliveryCharge': ?includeDeliveryCharge,
      });

  Future<void> returningMoney(int id, {required String note, List<XFile> files = const []}) async {
    final body = await buildMultipart(fields: {'note': note.trim()}, multiFiles: {if (files.isNotEmpty) 'files': files});
    await _api.post<Object?>('/returns/$id/returning-money', body: body);
  }

  PageFetcher<RefundRecord> refundsFetcher({String? status, String search = ''}) => (page) async {
        final json = await _api.get<Map<String, dynamic>>('/order/refunds', query: {
          'page': page,
          'pageSize': 20,
          'status': ?status,
          if (search.trim().isNotEmpty) 'search': search.trim(),
        });
        return _page(json, (r) => RefundRecord(r));
      };

  Future<Map<String, int>> refundSummary() async {
    final json = await _api.get<Map<String, dynamic>>('/order/refunds/summary');
    return {for (final e in json.entries) e.key: (e.value as num).toInt()};
  }

  Future<RefundRecord> refund(int id) async => RefundRecord(await _api.get<Map<String, dynamic>>('/order/refunds/$id'));

  /// Moves a refund one step. `refunded` needs the exact amount, a note and proof.
  Future<void> changeRefund(int id, String status, {double? amount, String? note, String? transactionId, List<XFile> files = const []}) async {
    final body = await buildMultipart(
      fields: {
        'status': status,
        if (amount != null) 'amount': amount.toStringAsFixed(2),
        if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
        if (transactionId != null && transactionId.trim().isNotEmpty) 'transactionId': transactionId.trim(),
      },
      multiFiles: {if (files.isNotEmpty) 'files': files},
    );
    await _api.post<Object?>('/order/refunds/$id/status', body: body);
  }

  PagedResult<T> _page<T>(Map<String, dynamic> json, T Function(Map<String, dynamic>) make) => PagedResult(
        items: [for (final r in (json['results'] as List)) make(r as Map<String, dynamic>)],
        page: (json['page'] as num).toInt(),
        totalPages: (json['totalPages'] as num).toInt(),
      );
}
