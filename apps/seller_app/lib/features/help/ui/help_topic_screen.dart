import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/error_view.dart';
import '../../../shared/widgets/loading_view.dart';
import '../data/help_api.dart';
import 'help_blocks.dart';
import 'help_icons.dart';

/// One help topic: its sections open and close, and a button leads to the screen it explains.
class HelpTopicScreen extends ConsumerWidget {
  const HelpTopicScreen({super.key, required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final data = ref.watch(helpTopicProvider(slug));
    return Scaffold(
      appBar: AppBar(title: Text(data.value?.title ?? 'Help')),
      body: data.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(message: ApiException.from(e).message, onRetry: () => ref.invalidate(helpTopicProvider(slug))),
        data: (t) {
          final route = appRouteFor(t.openPath);
          return ListView(padding: const EdgeInsets.all(AppSpacing.m), children: [
            if (t.summary != null) Text(t.summary!, style: const TextStyle(fontSize: 16)),
            if (route != null) ...[
              const SizedBox(height: AppSpacing.m),
              FilledButton.icon(
                onPressed: () => route.startsWith('/?') ? context.go(route) : context.push(route),
                icon: Icon(helpIcon(t.icon)),
                label: Text(t.openLabel ?? 'Open'),
              ),
            ],
            const SizedBox(height: AppSpacing.m),
            for (var i = 0; i < t.sections.length; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.s),
                child: AppCard(
                  padding: EdgeInsets.zero,
                  child: Theme(
                    data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                    child: ExpansionTile(
                      initiallyExpanded: i == 0,
                      tilePadding: const EdgeInsets.symmetric(horizontal: AppSpacing.m),
                      childrenPadding: const EdgeInsets.fromLTRB(AppSpacing.m, 0, AppSpacing.m, AppSpacing.m),
                      expandedCrossAxisAlignment: CrossAxisAlignment.start,
                      title: Text(t.sections[i].title, style: const TextStyle(fontWeight: FontWeight.w700)),
                      children: [
                        if (t.sections[i].intro != null) Text(t.sections[i].intro!),
                        for (final b in t.sections[i].blocks) HelpBlockView(b),
                      ],
                    ),
                  ),
                ),
              ),
            const SizedBox(height: AppSpacing.xl),
          ]);
        },
      ),
    );
  }
}
