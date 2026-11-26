import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/api/api_client.dart';
import '../../../shared/media/multipart_upload.dart';
import 'return_models.dart';

final returnApiProvider = Provider<ReturnApi>((ref) => ReturnApi(ref.read(apiClientProvider)));

class ReturnPage {
  ReturnPage({required this.results, required this.page, required this.totalPages});
  final List<ReturnSummary> results;
  final int page;
  final int totalPages;
}

/// Every server path this feature uses, in one place (rule 6 in root `rules.md`).
class ReturnApi {
  ReturnApi(this._client);
  final ApiClient _client;

  Future<ReturnPage> list({String? status, int page = 1}) async {
    final json = await _client.get<Map<String, dynamic>>('/returns', query: {'page': page, 'status': ?status});
    return ReturnPage(
      results: (json['results'] as List).cast<Map<String, dynamic>>().map(ReturnSummary.fromJson).toList(),
      page: json['page'] as int,
      totalPages: json['totalPages'] as int,
    );
  }

  Future<ReturnEligibility> eligibility(int orderId) async {
    final json = await _client.get<Map<String, dynamic>>('/returns/eligibility/$orderId');
    return ReturnEligibility.fromJson(json);
  }

  Future<ReturnDetail> get(int id) async {
    final json = await _client.get<Map<String, dynamic>>('/returns/$id');
    return ReturnDetail.fromJson(json);
  }

  Future<void> create({
    required int orderId,
    required String scope,
    List<int>? orderItemIds,
    String? reasonCode,
    required String reason,
    List<XFile> files = const [],
  }) async {
    final body = await buildMultipart(
      fields: {
        'orderId': orderId,
        'scope': scope,
        'orderItemIds': ?orderItemIds?.join(','),
        'reasonCode': ?reasonCode,
        'reason': reason,
      },
      multiFiles: files.isEmpty ? {} : {'files': files},
    );
    await _client.post<Object?>('/returns', body: body);
  }

  Future<void> cancel(int id, {String? note}) => _client.post<Object?>('/returns/$id/cancel', body: {'note': ?note});
}
