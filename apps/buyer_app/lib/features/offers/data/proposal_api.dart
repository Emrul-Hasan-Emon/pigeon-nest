import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import 'proposal_models.dart';

final proposalApiProvider = Provider<ProposalApi>((ref) => ProposalApi(ref.read(apiClientProvider)));

class ProposalPage {
  ProposalPage({required this.results, required this.nextCursor});
  final List<Proposal> results;
  final int? nextCursor;
}

/// Every server path this feature uses, in one place (rule 6 in root `rules.md`).
class ProposalApi {
  ProposalApi(this._client);
  final ApiClient _client;

  Future<ProposalPage> list({String? status, int? cursor}) async {
    final json = await _client.get<Map<String, dynamic>>('/proposals', query: {'status': ?status, 'cursor': ?cursor});
    return ProposalPage(
      results: (json['results'] as List).cast<Map<String, dynamic>>().map(Proposal.fromJson).toList(),
      nextCursor: json['nextCursor'] as int?,
    );
  }

  /// The open proposal on a SKU, if any (used to show "offer pending" on the product page).
  Future<Proposal?> forSku(int skuId) async {
    final json = await _client.get<Map<String, dynamic>>('/proposals/sku/$skuId');
    final p = json['proposal'];
    return p == null ? null : Proposal.fromJson(p as Map<String, dynamic>);
  }

  Future<ProposalDetail> get(int id) async {
    final json = await _client.get<Map<String, dynamic>>('/proposals/$id');
    return ProposalDetail.fromJson(json);
  }

  Future<void> create({required int sellerProductSkuId, required int quantity, required num price, String? note}) =>
      _client.post<Object?>('/proposals', body: {'sellerProductSkuId': sellerProductSkuId, 'quantity': quantity, 'price': price, 'note': ?note});

  Future<void> accept(int id, {String? note}) => _client.post<Object?>('/proposals/$id/accept', body: {'note': ?note});
  Future<void> counter(int id, {required num price, int? quantity, String? note}) =>
      _client.post<Object?>('/proposals/$id/counter', body: {'price': price, 'quantity': ?quantity, 'note': ?note});
  Future<void> reject(int id, {String? note}) => _client.post<Object?>('/proposals/$id/reject', body: {'note': ?note});
  Future<void> cancel(int id, {String? note}) => _client.post<Object?>('/proposals/$id/cancel', body: {'note': ?note});
}
