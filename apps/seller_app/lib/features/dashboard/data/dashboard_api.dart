import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import 'dashboard_models.dart';

class DashboardRangeController extends Notifier<DashboardRange> {
  @override
  DashboardRange build() => DashboardRange.month;

  void choose(DashboardRange range) => state = range;
}

final dashboardRangeProvider = NotifierProvider<DashboardRangeController, DashboardRange>(DashboardRangeController.new);

/// One call returns every figure on the page; changing the range refetches it.
final dashboardProvider = FutureProvider.autoDispose<Dashboard>((ref) async {
  final range = ref.watch(dashboardRangeProvider);
  final json = await ref.watch(apiClientProvider).get<Map<String, dynamic>>('/dashboard', query: {'range': range.value});
  return Dashboard(json);
});
