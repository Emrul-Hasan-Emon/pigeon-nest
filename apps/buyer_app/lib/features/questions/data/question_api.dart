import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import 'question_models.dart';

final questionApiProvider = Provider<QuestionApi>((ref) => QuestionApi(ref.read(apiClientProvider)));

class QuestionPage {
  QuestionPage({required this.results, required this.page, required this.totalPages});
  final List<PublicQuestion> results;
  final int page;
  final int totalPages;
}

/// Every server path this feature uses, in one place (rule 6 in root `rules.md`).
class QuestionApi {
  QuestionApi(this._client);
  final ApiClient _client;

  Future<QuestionPage> forProduct(int productId, int page) async {
    final json = await _client.get<Map<String, dynamic>>('/questions/product/$productId', query: {'page': page});
    return QuestionPage(
      results: (json['results'] as List).cast<Map<String, dynamic>>().map(PublicQuestion.fromJson).toList(),
      page: json['page'] as int,
      totalPages: json['totalPages'] as int,
    );
  }

  Future<void> ask(int productId, String question) => _client.post<Object?>('/questions/product/$productId', body: {'question': question});
}
