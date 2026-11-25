import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_client.dart';
import 'help_models.dart';

final helpTopicsProvider = FutureProvider.autoDispose<List<HelpTopic>>((ref) async {
  final json = await ref.watch(apiClientProvider).get<Map<String, dynamic>>('/help');
  return [for (final t in (json['topics'] as List)) HelpTopic(t as Map<String, dynamic>)];
});

final helpTopicProvider = FutureProvider.autoDispose.family<HelpTopic, String>((ref, slug) async => HelpTopic(await ref.watch(apiClientProvider).get<Map<String, dynamic>>('/help/$slug')));
