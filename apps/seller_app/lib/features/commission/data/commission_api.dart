import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../shared/paging/cursor_list_controller.dart';
import 'commission_models.dart';

final commissionApiProvider = Provider<CommissionApi>((ref) => CommissionApi(ref));
final commissionBalanceProvider = FutureProvider.autoDispose<CommissionBalance>((ref) => ref.watch(commissionApiProvider).balance());
final disbursementProvider = FutureProvider.autoDispose.family<Disbursement, int>((ref, id) => ref.watch(commissionApiProvider).disbursement(id));

/// Read-only: what the seller owes the marketplace and how it was worked out.
class CommissionApi {
  CommissionApi(this._ref);
  final Ref _ref;
  ApiClient get _api => _ref.read(apiClientProvider);

  Future<CommissionBalance> balance() async => CommissionBalance(await _api.get<Map<String, dynamic>>('/commission/balance'));

  CursorFetcher<T> _cursor<T>(String path, T Function(Map<String, dynamic>) make) => (cursor) async {
        final json = await _api.get<Map<String, dynamic>>(path, query: {'limit': 20, 'cursor': ?cursor});
        return CursorResult(items: [for (final r in (json['results'] as List)) make(r as Map<String, dynamic>)], nextCursor: json['nextCursor']?.toString());
      };

  CursorFetcher<CommissionLine> historyFetcher() => _cursor('/commission/history', CommissionLine.new);
  CursorFetcher<RateChange> rateChangesFetcher() => _cursor('/commission/setting/history', RateChange.new);
  CursorFetcher<Disbursement> disbursementsFetcher() => _cursor('/commission/disbursements', Disbursement.new);

  Future<Disbursement> disbursement(int id) async => Disbursement(await _api.get<Map<String, dynamic>>('/commission/disbursements/$id'));
}
