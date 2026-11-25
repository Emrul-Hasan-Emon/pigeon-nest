import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import 'report_models.dart';

final reportsApiProvider = Provider<ReportsApi>((ref) => ReportsApi(ref));

/// What to ask for: the report, the dates (YYYY-MM-DD) and the one option each report has.
class ReportQuery {
  const ReportQuery({required this.report, this.from, this.to, this.option});
  final String report; // sales, orders, products, earnings, returns
  final String? from, to, option;

  @override
  bool operator ==(Object other) => other is ReportQuery && other.report == report && other.from == from && other.to == to && other.option == option;

  @override
  int get hashCode => Object.hash(report, from, to, option);
}

final reportProvider = FutureProvider.autoDispose.family<Report, ReportQuery>((ref, q) => ref.watch(reportsApiProvider).report(q));
final statementProvider = FutureProvider.autoDispose.family<Statement, String>((ref, month) => ref.watch(reportsApiProvider).statement(month));

class ReportsApi {
  ReportsApi(this._ref);
  final Ref _ref;
  ApiClient get _api => _ref.read(apiClientProvider);

  /// The option is `groupBy` for sales and earnings, `kind` for products, `by` for returns.
  Future<Report> report(ReportQuery q) async {
    final optionKey = switch (q.report) { 'sales' || 'earnings' => 'groupBy', 'products' => 'kind', 'returns' => 'by', _ => null };
    return Report(await _api.get<Map<String, dynamic>>('/reports/${q.report}', query: {
      'from': ?q.from,
      'to': ?q.to,
      if (optionKey != null && q.option != null) optionKey: q.option,
    }));
  }

  Future<Statement> statement(String month) async => Statement(await _api.get<Map<String, dynamic>>('/reports/statement', query: {'month': month}));
}
