import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import '../../../shared/paging/page_list_controller.dart';
import 'question_models.dart';

final questionsApiProvider = Provider<QuestionsApi>((ref) => QuestionsApi(ref));
final questionSummaryProvider = FutureProvider.autoDispose<({int unanswered, int answered})>((ref) => ref.watch(questionsApiProvider).summary());

class QuestionsApi {
  QuestionsApi(this._ref);
  final Ref _ref;
  ApiClient get _api => _ref.read(apiClientProvider);

  /// [show]: unanswered, answered, or all.
  PageFetcher<Question> listFetcher({String show = 'unanswered', String search = ''}) => (page) async {
        final json = await _api.get<Map<String, dynamic>>('/questions', query: {
          'page': page,
          'pageSize': 20,
          'show': show,
          if (search.trim().isNotEmpty) 'search': search.trim(),
        });
        return PagedResult(
          items: [for (final r in (json['results'] as List)) Question(r as Map<String, dynamic>)],
          page: (json['page'] as num).toInt(),
          totalPages: (json['totalPages'] as num).toInt(),
        );
      };

  Future<({int unanswered, int answered})> summary() async {
    final json = await _api.get<Map<String, dynamic>>('/questions/summary');
    return (unanswered: (json['unanswered'] as num).toInt(), answered: (json['answered'] as num).toInt());
  }

  /// Answers, or changes the answer already given.
  Future<void> answer(int id, String answer) => _api.post<Object?>('/questions/$id/answer', body: {'answer': answer.trim()});
}
