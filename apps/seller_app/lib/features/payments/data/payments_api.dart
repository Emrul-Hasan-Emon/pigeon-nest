import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../shared/paging/cursor_list_controller.dart';
import '../../../shared/paging/page_list_controller.dart';
import 'payment_models.dart';

final paymentsApiProvider = Provider<PaymentsApi>((ref) => PaymentsApi(ref));

final paymentDetailProvider = FutureProvider.autoDispose.family<PaymentDetail, int>((ref, id) => ref.watch(paymentsApiProvider).detail(id));
final payAccountsProvider = FutureProvider.autoDispose<List<PayAccount>>((ref) => ref.watch(paymentsApiProvider).accounts());

/// Payments on the seller's orders, the buyers' "I have paid" messages, and the accounts buyers pay into.
class PaymentsApi {
  PaymentsApi(this._ref);
  final Ref _ref;
  ApiClient get _api => _ref.read(apiClientProvider);

  CursorFetcher<PaymentRow> listFetcher({String? status, String search = ''}) => (cursor) async {
        final json = await _api.get<Map<String, dynamic>>('/order/payments', query: {
          'limit': 20,
          'status': ?status,
          if (search.trim().isNotEmpty) 'orderNumber': search.trim(),
          'cursor': ?cursor,
        });
        return CursorResult(
          items: [for (final r in (json['results'] as List)) PaymentRow(r as Map<String, dynamic>)],
          nextCursor: json['nextCursor']?.toString(),
        );
      };

  Future<PaymentDetail> detail(int id) async => PaymentDetail(await _api.get<Map<String, dynamic>>('/order/payments/$id'));

  PageFetcher<Claim> claimsFetcher({String? status}) => (page) async {
        final json = await _api.get<Map<String, dynamic>>('/payment-claims', query: {'page': page, 'pageSize': 20, 'status': ?status});
        return PagedResult(
          items: [for (final r in (json['results'] as List)) Claim(r as Map<String, dynamic>)],
          page: (json['page'] as num).toInt(),
          totalPages: (json['totalPages'] as num).toInt(),
        );
      };

  Future<int> pendingClaims() async => ((await _api.get<Map<String, dynamic>>('/payment-claims/summary'))['pending'] as num).toInt();

  Future<void> confirmClaim(int id, {double? amount, String? note}) => _api.post<Object?>('/payment-claims/$id/confirm', body: {
        'amount': ?amount,
        if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
      });

  Future<void> rejectClaim(int id, String reason) => _api.post<Object?>('/payment-claims/$id/reject', body: {'reason': reason.trim()});

  Future<List<PayAccount>> accounts() async => [for (final a in await _api.get<List<dynamic>>('/profile/payment-accounts')) PayAccount(a as Map<String, dynamic>)];

  Future<void> createAccount({required String kind, required String provider, required String number, String? name, String? branch, String? note}) =>
      _api.post<Object?>('/profile/payment-accounts', body: {
        'kind': kind,
        'provider': provider.trim(),
        'accountNumber': number.trim(),
        if (name != null && name.trim().isNotEmpty) 'accountName': name.trim(),
        if (branch != null && branch.trim().isNotEmpty) 'branchName': branch.trim(),
        if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
      });

  /// Empty text clears the field on the server (it turns blanks into null).
  Future<void> updateAccount(int id, {required String provider, required String number, String? name, String? branch, String? note}) =>
      _api.patch<Object?>('/profile/payment-accounts/$id', body: {
        'provider': provider.trim(),
        'accountNumber': number.trim(),
        'accountName': (name ?? '').trim(),
        'branchName': (branch ?? '').trim(),
        'note': (note ?? '').trim(),
      });

  Future<void> setAccountActive(int id, bool active) => _api.patch<Object?>('/profile/payment-accounts/$id', body: {'isActive': active});
}
