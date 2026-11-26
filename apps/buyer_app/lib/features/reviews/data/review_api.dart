import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/api/api_client.dart';
import '../../../shared/media/multipart_upload.dart';
import 'review_models.dart';

final reviewApiProvider = Provider<ReviewApi>((ref) => ReviewApi(ref.read(apiClientProvider)));

class CursorPage<T> {
  CursorPage({required this.results, required this.nextCursor});
  final List<T> results;
  final int? nextCursor;
}

/// Every server path this feature uses, in one place (rule 6 in root `rules.md`).
class ReviewApi {
  ReviewApi(this._client);
  final ApiClient _client;

  Future<RatingSummary> productSummary(int productId) async {
    final json = await _client.get<Map<String, dynamic>>('/review/product/$productId/summary');
    return RatingSummary.fromJson(json);
  }

  Future<CursorPage<PublicReview>> productList(int productId, {int? rating, bool? withPhotos, String sort = 'newest', int? cursor}) async {
    final json = await _client.get<Map<String, dynamic>>('/review/product/$productId', query: {
      'rating': ?rating,
      'withPhotos': ?withPhotos,
      'sort': sort,
      'cursor': ?cursor,
    });
    return CursorPage(results: (json['results'] as List).cast<Map<String, dynamic>>().map(PublicReview.fromJson).toList(), nextCursor: json['nextCursor'] as int?);
  }

  Future<CursorPage<PendingReviewItem>> pending({int? cursor}) async {
    final json = await _client.get<Map<String, dynamic>>('/review/pending', query: {'cursor': ?cursor});
    return CursorPage(results: (json['results'] as List).cast<Map<String, dynamic>>().map(PendingReviewItem.fromJson).toList(), nextCursor: json['nextCursor'] as int?);
  }

  Future<CursorPage<MyReview>> mine({int? cursor}) async {
    final json = await _client.get<Map<String, dynamic>>('/review', query: {'cursor': ?cursor});
    return CursorPage(results: (json['results'] as List).cast<Map<String, dynamic>>().map(MyReview.fromJson).toList(), nextCursor: json['nextCursor'] as int?);
  }

  Future<Set<int>> votes(int productId) async {
    final json = await _client.get<Map<String, dynamic>>('/review/votes', query: {'productId': productId});
    return (json['reviewIds'] as List).cast<int>().toSet();
  }

  Future<void> create({required int orderItemId, required int rating, String? title, String? comment, List<XFile> images = const []}) async {
    final body = await buildMultipart(
      fields: {'orderItemId': orderItemId, 'rating': rating, 'title': ?title, 'comment': ?comment},
      multiFiles: images.isEmpty ? {} : {'images': images},
    );
    await _client.post<Object?>('/review', body: body);
  }

  Future<void> update(int id, {int? rating, String? title, String? comment, List<XFile> images = const []}) async {
    final body = await buildMultipart(
      fields: {'rating': ?rating, 'title': ?title, 'comment': ?comment},
      multiFiles: images.isEmpty ? {} : {'images': images},
    );
    await _client.patch<Object?>('/review/$id', body: body);
  }

  Future<void> remove(int id) => _client.delete<Object?>('/review/$id');

  Future<void> markHelpful(int id) => _client.post<Object?>('/review/$id/helpful');
  Future<void> unmarkHelpful(int id) => _client.delete<Object?>('/review/$id/helpful');

  Future<void> report(int id, {required String reason, String? note}) => _client.post<Object?>('/review/$id/report', body: {'reason': reason, 'note': ?note});

  Future<CursorPage<ReviewReply>> thread(int reviewId, {int? cursor}) async {
    final json = await _client.get<Map<String, dynamic>>('/review/$reviewId/replies', query: {'cursor': ?cursor});
    return CursorPage(results: (json['results'] as List).cast<Map<String, dynamic>>().map(ReviewReply.fromJson).toList(), nextCursor: json['nextCursor'] as int?);
  }
}
