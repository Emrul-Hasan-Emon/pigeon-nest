import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../core/config/app_config.dart';
import '../../../shared/paging/cursor_list_controller.dart';
import 'review_models.dart';

final reviewsApiProvider = Provider<ReviewsApi>((ref) => ReviewsApi(ref));
final reviewSummaryProvider = FutureProvider.autoDispose<ReviewSummary>((ref) => ref.watch(reviewsApiProvider).summary());

/// A review's replies, or the replies under one reply when [parentId] is given.
typedef ThreadKey = ({int reviewId, int? parentId});
final repliesProvider = FutureProvider.autoDispose.family<List<Reply>, ThreadKey>((ref, k) => ref.watch(reviewsApiProvider).replies(k.reviewId, parentId: k.parentId));

class ReviewsApi {
  ReviewsApi(this._ref);
  final Ref _ref;
  ApiClient get _api => _ref.read(apiClientProvider);

  CursorFetcher<Review> listFetcher({int? rating, bool unreplied = false}) => (cursor) async {
        final json = await _api.get<Map<String, dynamic>>('/review', query: {
          'limit': 20,
          'rating': ?rating,
          if (unreplied) 'unreplied': true,
          'cursor': ?cursor,
        });
        return CursorResult(items: [for (final r in (json['results'] as List)) Review(r as Map<String, dynamic>)], nextCursor: json['nextCursor']?.toString());
      };

  Future<ReviewSummary> summary() async => ReviewSummary(await _api.get<Map<String, dynamic>>('/review/summary'));

  /// The thread is public: it lives under the buyer's review route.
  Future<List<Reply>> replies(int reviewId, {int? parentId}) async {
    final json = await _api.get<Map<String, dynamic>>('${AppConfig.apiBaseUrl}/user/review/$reviewId/replies', query: {'parentId': ?parentId, 'limit': 100});
    return [for (final r in (json['results'] as List)) Reply(r as Map<String, dynamic>)];
  }

  Future<void> reply(int reviewId, String body, {int? parentId}) => _api.post<Object?>('/review/$reviewId/replies', body: {'body': body.trim(), 'parentId': ?parentId});
  Future<void> editReply(int replyId, String body) => _api.patch<Object?>('/review/replies/$replyId', body: {'body': body.trim()});
  Future<void> reportReview(int id, String reason, {String? note}) => _api.post<Object?>('/review/$id/report', body: _report(reason, note));
  Future<void> reportReply(int id, String reason, {String? note}) => _api.post<Object?>('/review/replies/$id/report', body: _report(reason, note));

  Map<String, dynamic> _report(String reason, String? note) => {'reason': reason, if (note != null && note.trim().isNotEmpty) 'note': note.trim()};
}
