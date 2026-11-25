import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../shared/paging/cursor_list_controller.dart';
import 'offer_models.dart';

final offersApiProvider = Provider<OffersApi>((ref) => OffersApi(ref));
final offerSummaryProvider = FutureProvider.autoDispose<OfferSummary>((ref) => ref.watch(offersApiProvider).summary());
final offerProvider = FutureProvider.autoDispose.family<Offer, int>((ref, id) => ref.watch(offersApiProvider).get(id));

/// Price offers from buyers. The seller accepts, counters with a new price, or rejects.
class OffersApi {
  OffersApi(this._ref);
  final Ref _ref;
  ApiClient get _api => _ref.read(apiClientProvider);

  /// [awaitingYou] shows only the offers waiting for the seller's answer.
  CursorFetcher<Offer> listFetcher({String? status, bool awaitingYou = false}) => (cursor) async {
        final json = await _api.get<Map<String, dynamic>>('/proposals', query: {
          'limit': 20,
          'status': ?status,
          if (awaitingYou) 'awaiting': 'seller',
          'cursor': ?cursor,
        });
        return CursorResult(items: [for (final r in (json['results'] as List)) Offer(r as Map<String, dynamic>)], nextCursor: json['nextCursor']?.toString());
      };

  Future<OfferSummary> summary() async => OfferSummary(await _api.get<Map<String, dynamic>>('/proposals/summary'));
  Future<Offer> get(int id) async => Offer(await _api.get<Map<String, dynamic>>('/proposals/$id'));

  Future<void> accept(int id, {String? note}) => _api.post<Object?>('/proposals/$id/accept', body: _note(note));
  Future<void> reject(int id, {String? note}) => _api.post<Object?>('/proposals/$id/reject', body: _note(note));

  Future<void> counter(int id, {required double price, int? quantity, String? note}) =>
      _api.post<Object?>('/proposals/$id/counter', body: {'price': price, 'quantity': ?quantity, ..._note(note)});

  Map<String, dynamic> _note(String? n) => {if (n != null && n.trim().isNotEmpty) 'note': n.trim()};
}
