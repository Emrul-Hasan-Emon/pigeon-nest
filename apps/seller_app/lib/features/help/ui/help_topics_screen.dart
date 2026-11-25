import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../data/help_api.dart';
import 'help_icons.dart';

/// Every how-to page the seller can read, in the website's order.
class HelpTopicsScreen extends ConsumerWidget {
  const HelpTopicsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(helpTopicsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Help topics')),
      body: data.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: ApiException.from(e).message, onRetry: () => ref.invalidate(helpTopicsProvider)),
        data: (topics) => ListView.separated(
          padding: const EdgeInsets.all(AppSpacing.m),
          itemCount: topics.length,
          separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.s),
          itemBuilder: (_, i) {
            final t = topics[i];
            return AppCard(
              onTap: () => context.push('/more/help/${t.slug}'),
              child: Row(children: [
                Icon(helpIcon(t.icon), size: 30),
                const SizedBox(width: AppSpacing.m),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(t.title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)), if (t.summary != null) Text(t.summary!, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppTheme.neutral, fontSize: 13))])),
                const Icon(Icons.chevron_right),
              ]),
            );
          },
        ),
      ),
    );
  }
}
