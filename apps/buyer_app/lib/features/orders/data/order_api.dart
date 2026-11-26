import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/api/api_client.dart';
import '../../../shared/media/multipart_upload.dart';
import 'order_models.dart';

final orderApiProvider = Provider<OrderApi>((ref) => OrderApi(ref.read(apiClientProvider)));

class OrderPage {
  OrderPage({required this.results, required this.page, required this.totalPages});
  final List<OrderSummary> results;
  final int page;
  final int totalPages;
}

/// Every server path this feature uses, in one place (rule 6 in root `rules.md`).
class OrderApi {
  OrderApi(this._client);
  final ApiClient _client;

  Future<OrderPage> list({String? status, String? paymentStatus, String? search, required int page}) async {
    final json = await _client.get<Map<String, dynamic>>('/order', query: {
      'page': page,
      'status': ?status,
      'paymentStatus': ?paymentStatus,
      'search': ?search,
    });
    return OrderPage(
      results: (json['results'] as List).cast<Map<String, dynamic>>().map(OrderSummary.fromJson).toList(),
      page: json['page'] as int,
      totalPages: json['totalPages'] as int,
    );
  }

  Future<OrderDetail> detail(int id) async {
    final json = await _client.get<Map<String, dynamic>>('/order/$id');
    return OrderDetail.fromJson(json);
  }

  Future<OrderDetail> cancel(int id, {String? reason}) async {
    final json = await _client.post<Map<String, dynamic>>('/order/$id/cancel', body: reason == null ? {} : {'reason': reason});
    return OrderDetail.fromJson(json);
  }

  Future<OrderDetail> track(String orderNumber, String phone) async {
    final json = await _client.get<Map<String, dynamic>>('/order/track', query: {'orderNumber': orderNumber, 'phone': phone});
    return OrderDetail.fromJson(json);
  }

  Future<void> submitPaymentClaim(
    int orderId, {
    required num amount,
    required String transactionId,
    required String method,
    String? senderNumber,
    String? note,
    required List<XFile> files,
  }) async {
    final body = await buildMultipart(
      fields: {
        'amount': amount,
        'transactionId': transactionId,
        'method': method,
        'senderNumber': ?senderNumber,
        'note': ?note,
      },
      multiFiles: {'files': files},
    );
    await _client.post<Object?>('/orders/$orderId/payment-claims', body: body);
  }
}
